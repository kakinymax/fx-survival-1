import {INITIAL,getStage,settle,winners} from './engine.js';

// Money is always a decimal string in ¥1,000 units, including in stored records.
export const RECORD_VERSION=1;
const copy=value=>JSON.parse(JSON.stringify(value));
const max=(a,b)=>a>b?a:b;
export function ensureGameIdentity(game,{newGame=false,now=new Date().toISOString(),id=()=>crypto.randomUUID()}={}){
  if(!game.gameId){game.gameId=id();game.startedAt=newGame?now:null}
  if(game.phase==='end'&&!game.finalRecord){
    game.endedAt=game.endedAt??now;
    game.finalRecord=createMatchRecord(game);
  }
  return game;
}
export function playerMetrics(id,history,initial=INITIAL){
  let peak=BigInt(initial),gain=0n,loss=0n,drawdown=0n,maxLeverage=0,uses100=0,uses50Plus=0;
  for(const round of history){
    const trade=round.results.find(r=>r.id===id);if(!trade)continue;
    const after=BigInt(trade.after),pnl=BigInt(trade.pnl);
    gain=max(gain,pnl);loss=max(loss,-pnl);
    peak=max(peak,after);drawdown=max(drawdown,peak-after);
    maxLeverage=Math.max(maxLeverage,trade.leverage);
    if(trade.leverage===100)uses100++;
    if(trade.leverage>=50)uses50Plus++;
  }
  return {maxLeverage,uses100,uses50Plus,maxRoundProfit:String(gain),maxRoundLoss:String(loss),maxDrawdown:String(drawdown)};
}
export function createMatchRecord(game){
  if(game.phase!=='end'||game.players.some(p=>p.status==='active')||!game.history.length)throw Error('終了したゲームだけ保存できます');
  const stage=getStage(game.stage??'classic');
  return {
    schemaVersion:RECORD_VERSION,id:game.gameId,startedAt:game.startedAt??null,endedAt:game.endedAt,
    stage:{id:stage.id,name:stage.name},playMode:game.playMode??'tabletop',drawMode:game.mode,
    maxRounds:12,endedRound:game.round,
    ownerPlayerId:game.playMode==='solo'?game.players.find(p=>!p.cpu).id:null,
    players:game.players.map(p=>({id:p.id,name:p.name,kind:p.cpu?'cpu':'human',cpu:p.cpu??null,
      initial:INITIAL,wealth:p.wealth,peak:p.peak,maxPosition:p.maxPosition,status:p.status,
      metrics:playerMetrics(p.id,game.history)})),
    winnerIds:winners(game).map(p=>p.id),history:copy(game.history).map(h=>({...h,stage:h.stage??stage.id,second:h.second??null})),lastDecisions:copy(game.lastDecisions??null)
  };
}

// The write boundary checks the submitted immutable snapshot using the existing
// settlement function. It does not calculate a different version of the result.
export function validateMatchRecord(record){
  const fail=()=>{throw Error('試合記録が正しくありません')};
  if(!record||record.schemaVersion!==RECORD_VERSION||!/^[-a-zA-Z0-9_]{1,100}$/.test(record.id??'')||
    !['solo','tabletop'].includes(record.playMode)||!['auto','manual'].includes(record.drawMode)||
    record.maxRounds!==12||!Number.isInteger(record.endedRound)||record.endedRound<1||record.endedRound>12||
    !Array.isArray(record.players)||record.players.length<2||record.players.length>6||
    !Array.isArray(record.history)||record.history.length!==record.endedRound)fail();
  const date=v=>typeof v==='string'&&new Date(v).toISOString()===v;
  if(!date(record.endedAt)||record.startedAt!==null&&!date(record.startedAt)||record.startedAt&&record.startedAt>record.endedAt)fail();
  const stage=getStage(record.stage?.id);if(record.stage.name!==stage.name)fail();
  const amounts=['initial','wealth','peak','maxPosition'];
  const ids=new Set();
  for(const p of record.players){
    if(!Number.isInteger(p.id)||p.id<0||p.id>5||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>20||
      !['human','cpu'].includes(p.kind)||p.kind==='human'&&p.cpu!==null||p.kind==='cpu'&&typeof p.cpu!=='string'||
      !['fixed','cut','empty','debt'].includes(p.status)||amounts.some(k=>typeof p[k]!=='string'||!/^(-?[1-9]\d*|0)$/.test(p[k])||p[k].length>50)||p.initial!==INITIAL)fail();
    ids.add(p.id);
  }
  const humans=record.players.filter(p=>p.kind==='human');
  if(record.playMode==='solo'?(humans.length!==1||record.ownerPlayerId!==humans[0].id):record.ownerPlayerId!==null)fail();
  const state=new Map(record.players.map(p=>[p.id,{id:p.id,wealth:p.initial,peak:p.initial,maxPosition:'0',status:'active'}]));
  for(const [i,h] of record.history.entries()){
    if(h.round!==i+1||h.stage!==stage.id||!Array.isArray(h.results)||!h.results.length||h.results.length>record.players.length)fail();
    const seen=new Set();
    for(const r of h.results){
      if(!ids.has(r.id)||seen.has(r.id))fail();seen.add(r.id);
      const before=state.get(r.id),expected=settle(before,r,h.direction,{bps:h.bps,gap:h.gap}).result;
      // Verify the dice table as well as balance arithmetic.
      const bps=h.first===6?stage.shock[h.second-1]:stage.normal[h.first-1];
      if(!Number.isInteger(h.first)||h.first<1||h.first>6||h.first===6&&(!Number.isInteger(h.second)||h.second<1||h.second>6)||
        h.first!==6&&h.second!==null||h.bps!==bps||h.gap!==(h.first===6&&h.second>=4)||
        Object.keys(expected).some(k=>r[k]!==expected[k]))fail();
      state.set(r.id,settle(before,r,h.direction,{bps:h.bps,gap:h.gap}).player);
    }
    for(const p of state.values())if(p.status==='active'&&!seen.has(p.id))fail();
    if(h.decisions){
      if(Object.keys(h.decisions).some(id=>!ids.has(Number(id))))fail();
      for(const [id,choice] of Object.entries(h.decisions)){
        const p=state.get(Number(id));if(p.status!=='active'||!['continue','fix'].includes(choice))fail();
        if(choice==='fix')p.status='fixed';
      }
    }
  }
  for(const p of record.players){
    const computed=state.get(p.id);
    if(['wealth','peak','maxPosition'].some(k=>p[k]!==computed[k])||
      (computed.status==='active'?p.status!=='fixed':p.status!==computed.status)||
      JSON.stringify(p.metrics)!==JSON.stringify(playerMetrics(p.id,record.history,p.initial)))fail();
  }
  if(JSON.stringify(record.winnerIds)!==JSON.stringify(winners(record).map(p=>p.id)))fail();
  return record;
}
