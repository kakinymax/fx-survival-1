import {roundUnits} from '../dist/engine.js';
import {playerMetrics} from '../dist/records.js';

const max=(a,b)=>a>b?a:b;
// This accumulator exists only for one read request; no lifetime totals are stored.
// ownerPlayerId is an explicit participant association, never a name match.
export function createLifetimeAccumulator(){
  let totalSavedGames=0,plays=0,wins=0,atOrAboveInitial=0,belowInitial=0,fundsDepleted=0,debtExits=0;
  let initialTotal=0n,finalTotal=0n,highestFinal=null,highestPeak=null,maxPosition=0n;
  let maxRoundProfit=0n,maxRoundLoss=0n,maxDebt=0n,maxDrawdown=0n,maxLeverage=0,uses100=0,uses50Plus=0;
  function add(record){
    if(record.schemaVersion!==1)throw Error('Unsupported match record version');
    totalSavedGames++;
    if(record.ownerPlayerId===null)return;
    const p=record.players.find(p=>p.id===record.ownerPlayerId);
    if(!p||p.kind!=='human')throw Error('Invalid owner participant');
    // Old records may lack a newly introduced metric. Only stored round logs are
    // used to fill it; historical markets and CPU decisions are never replayed.
    const m={...playerMetrics(p.id,record.history,p.initial),...p.metrics};
    const initial=BigInt(p.initial),final=BigInt(p.wealth),peak=BigInt(p.peak);
    plays++;if(record.winnerIds.includes(p.id))wins++;
    if(final>=initial)atOrAboveInitial++;else belowInitial++;
    if(['cut','empty'].includes(p.status))fundsDepleted++;
    if(p.status==='debt')debtExits++;
    initialTotal+=initial;finalTotal+=final;
    highestFinal=highestFinal===null?final:max(highestFinal,final);
    highestPeak=highestPeak===null?peak:max(highestPeak,peak);
    maxPosition=max(maxPosition,BigInt(p.maxPosition));
    maxRoundProfit=max(maxRoundProfit,BigInt(m.maxRoundProfit));
    maxRoundLoss=max(maxRoundLoss,BigInt(m.maxRoundLoss));
    maxDebt=max(maxDebt,-final);maxDrawdown=max(maxDrawdown,BigInt(m.maxDrawdown));
    maxLeverage=Math.max(maxLeverage,m.maxLeverage);uses100+=m.uses100;uses50Plus+=m.uses50Plus;
  }
  function result(){
    const pnlTotal=finalTotal-initialTotal,count=BigInt(plays);
    return {totalSavedGames,unassignedGames:totalSavedGames-plays,lifetime:{
      plays,wins,winRateTenths:plays?Number(roundUnits(BigInt(wins)*1000n,count)):null,
      atOrAboveInitial,belowInitial,fundsDepleted,debtExits,
      initialTotal:String(initialTotal),finalTotal:String(finalTotal),pnlTotal:String(pnlTotal),
      averageFinal:plays?String(roundUnits(finalTotal,count)):null,
      averagePnl:plays?String(roundUnits(pnlTotal,count)):null,
      highestFinal:highestFinal===null?null:String(highestFinal),highestPeak:highestPeak===null?null:String(highestPeak),
      maxPosition:String(maxPosition),maxRoundProfit:String(maxRoundProfit),maxRoundLoss:String(maxRoundLoss),
      maxDebt:String(maxDebt),maxDrawdown:String(maxDrawdown),maxLeverage,uses100,uses50Plus
    }};
  }
  return {add,result};
}
export function aggregateLifetime(records){const stats=createLifetimeAccumulator();for(const record of records)stats.add(record);return stats.result()}
export function summarizeMatch(record){
  return {id:record.id,endedAt:record.endedAt,stage:record.stage,playMode:record.playMode,
    maxRounds:record.maxRounds,endedRound:record.endedRound,ownerPlayerId:record.ownerPlayerId,
    winnerIds:record.winnerIds,players:record.players.map(({id,name,kind,cpu,initial,wealth,peak,maxPosition,status})=>({id,name,kind,cpu,initial,wealth,peak,maxPosition,status}))};
}
