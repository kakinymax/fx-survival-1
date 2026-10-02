import {roundUnits} from '../dist/engine.js';
import {playerMetrics} from '../dist/records.js';

export const RECORD_KEYS=['highestFinal','highestPeak','maxRoundProfit','profitRate','increasingRounds','maxPosition','maxLeverage','uses100','uses50Plus','maxRoundLoss','maxDrawdown','maxDebt','peakFall','retainedProfit','lowestWinningFinal','underInitialWin','debtFreeGames'];
const ascending=new Set(['lowestWinningFinal','underInitialWin']);
const compareScore=(a,b)=>{const d=a.n*b.d-b.n*a.d;return d<0n?-1:d>0n?1:0};
const newest=(a,b)=>a.endedAt===b.endedAt?(a.gameId===b.gameId?a.playerId-b.playerId:a.gameId>b.gameId?-1:1):a.endedAt>b.endedAt?-1:1;
const reference=(record,p)=>({gameId:record.id,playerId:p.id,playerName:p.name,kind:p.kind,cpu:p.cpu,stage:record.stage,playMode:record.playMode,endedAt:record.endedAt});

function board(key){
  let leaders=[],bestCount=0;
  const compare=(a,b)=>(ascending.has(key)?1:-1)*compareScore(a,b);
  return {
    add(ref,n,d=1n){
      const entry={...ref,n,d};
      if(!leaders.length||compare(entry,leaders[0])<0)bestCount=1;
      else if(compareScore(entry,leaders[0])===0)bestCount++;
      leaders.push(entry);leaders.sort((a,b)=>compare(a,b)||newest(a,b));leaders=leaders.slice(0,3);
    },
    result(){return {bestCount,leaders:leaders.map(entry=>{
      const {n,d,...ref}=entry;const first=leaders.findIndex(other=>compareScore(entry,other)===0);
      return {...ref,rank:first+1,value:String(key==='profitRate'?roundUnits(n*1000n,d):n)};
    })}}
  };
}

// Bounded, request-local leaderboards. Nothing is persisted besides the matches.
// add() receives records newest first, exactly like the owner/time D1 index.
export function createRecordAccumulator(){
  const scopes=Object.fromEntries(['self','human','cpu'].map(scope=>[scope,Object.fromEntries(RECORD_KEYS.map(key=>[key,board(key)]))]));
  const participants={self:0,human:0,cpu:0},runs=new Map();let finalized=false;
  function flushRun(identity){
    const run=runs.get(identity);if(!run)return;
    scopes[run.scope].debtFreeGames.add({...run.latest,startedAt:run.startedAt,startedGameId:run.startedGameId},BigInt(run.count));runs.delete(identity);
  }
  function streak(identity,scope,record,p){
    if(p.status==='debt'){flushRun(identity);return}
    let run=runs.get(identity);
    if(!run){run={scope,count:0,latest:reference(record,p)};runs.set(identity,run)}
    run.count++;run.startedAt=record.endedAt;run.startedGameId=record.id;
  }
  function addPlayer(scope,record,p){
    participants[scope]++;
    const ref=reference(record,p),b=scopes[scope],final=BigInt(p.wealth),initial=BigInt(p.initial),peak=BigInt(p.peak);
    const m={...playerMetrics(p.id,record.history,p.initial),...p.metrics};
    const positive=(key,value)=>{const n=BigInt(value);if(n>0n)b[key].add(ref,n)};
    b.highestFinal.add(ref,final);b.highestPeak.add(ref,peak);
    for(const key of ['maxPosition','maxLeverage','uses100','uses50Plus','maxRoundProfit','maxRoundLoss','maxDrawdown'])positive(key,key==='maxPosition'?p.maxPosition:m[key]);
    if(final>initial)b.profitRate.add(ref,final-initial,initial);
    positive('maxDebt',-final);positive('peakFall',peak-final);
    // A retained profit ends at the personal peak, with a positive net gain.
    if(final===peak)positive('retainedProfit',final-initial);
    if(record.winnerIds.includes(p.id)&&final>0n){b.lowestWinningFinal.add(ref,final);if(final<initial)b.underInitialWin.add(ref,final)}
    let run=0,longest=0;
    for(const h of record.history){const trade=h.results.find(r=>r.id===p.id);if(!trade)continue;run=BigInt(trade.pnl)>0n?run+1:0;longest=Math.max(longest,run)}
    positive('increasingRounds',longest);
  }
  function add(record){
    if(finalized)throw Error('Record aggregation already finalized');
    if(record.schemaVersion!==1)throw Error('Unsupported match record version');
    const owner=record.players.find(p=>p.id===record.ownerPlayerId);
    if(record.ownerPlayerId!==null&&(!owner||owner.kind!=='human'))throw Error('Invalid owner participant');
    for(const p of record.players){
      addPlayer(p.kind==='cpu'?'cpu':'human',record,p);
      if(p===owner){addPlayer('self',record,p);streak('owner','self',record,p)}
      // CPU policy IDs identify profiles across games; display names never do.
      if(p.kind==='cpu')streak(`cpu:${p.cpu}`,'cpu',record,p);
    }
  }
  function result(){
    if(!finalized){for(const identity of [...runs.keys()])flushRun(identity);finalized=true}
    return {scopes:Object.fromEntries(Object.entries(scopes).map(([scope,boards])=>[scope,{participants:participants[scope],records:Object.fromEntries(Object.entries(boards).map(([key,b])=>[key,b.result()]))}]))};
  }
  return {add,result};
}
export function aggregateRecords(records){
  const stats=createRecordAccumulator();
  for(const record of [...records].sort((a,b)=>newest({endedAt:a.endedAt,gameId:a.id,playerId:0},{endedAt:b.endedAt,gameId:b.id,playerId:0})))stats.add(record);
  return stats.result();
}
