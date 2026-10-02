import {STAGES,roundUnits} from '../dist/engine.js';
import {playerMetrics} from '../dist/records.js';
import {createLifetimeAccumulator} from './statistics.js';

// Rebuilt from immutable matches on each request. Stage IDs partition games;
// names and amounts come from the archive, never from replaying current rules.
export function createModeAccumulator(){
  const overall=createLifetimeAccumulator(),groups=new Map();
  function group(stage){return {stage:{id:stage.id,name:stage.name},latest:null,stats:createLifetimeAccumulator(),maxProfit:0n,maxLoss:0n,leverageTotal:0n,positionTotal:0n}}
  for(const stage of Object.values(STAGES))groups.set(stage.id,group(stage));
  function add(record){
    overall.add(record);
    if(record.ownerPlayerId===null)return;
    const p=record.players.find(p=>p.id===record.ownerPlayerId),stage=record.stage;
    if(!stage?.id||typeof stage.name!=='string')throw Error('Missing archived stage');
    if(!groups.has(stage.id))groups.set(stage.id,group(stage));
    const g=groups.get(stage.id),key=`${record.endedAt}/${record.id}`;
    if(g.latest===null||key>g.latest){g.stage.name=stage.name;g.latest=key}
    g.stats.add(record);
    const pnl=BigInt(p.wealth)-BigInt(p.initial);
    if(pnl>g.maxProfit)g.maxProfit=pnl;
    if(-pnl>g.maxLoss)g.maxLoss=-pnl;
    g.leverageTotal+=BigInt(p.metrics?.maxLeverage??playerMetrics(p.id,record.history,p.initial).maxLeverage);
    g.positionTotal+=BigInt(p.maxPosition);
  }
  function result(){
    const known=new Set(Object.keys(STAGES));
    const ordered=[...groups.values()].sort((a,b)=>{
      if(known.has(a.stage.id)&&known.has(b.stage.id))return [...known].indexOf(a.stage.id)-[...known].indexOf(b.stage.id);
      if(known.has(a.stage.id)!==known.has(b.stage.id))return known.has(a.stage.id)?-1:1;
      return a.stage.id<b.stage.id?-1:a.stage.id>b.stage.id?1:0;
    });
    return {...overall.result(),modes:ordered.map(g=>{
      const stats=g.stats.result().lifetime,count=BigInt(stats.plays);
      return {stage:{...g.stage},stats:{...stats,
        debtRateTenths:stats.plays?Number(roundUnits(BigInt(stats.debtExits)*1000n,count)):null,
        maxGameProfit:stats.plays?String(g.maxProfit):null,maxGameLoss:stats.plays?String(g.maxLoss):null,
        averageMaxLeverageTenths:stats.plays?String(roundUnits(g.leverageTotal*10n,count)):null,
        averageMaxPosition:stats.plays?String(roundUnits(g.positionTotal,count)):null
      }};
    })};
  }
  return {add,result};
}
export function aggregateModes(records){const stats=createModeAccumulator();for(const record of records)stats.add(record);return stats.result()}
