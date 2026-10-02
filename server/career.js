import {CPU_PROFILES} from '../dist/solo.js';

const later=(a,b)=>a.endedAt>b.endedAt||a.endedAt===b.endedAt&&a.id>b.id;
const self=record=>record.playMode==='solo'&&record.ownerPlayerId!==null?record.players.find(p=>p.id===record.ownerPlayerId&&p.kind==='human'):null;

// Read-time projections of immutable matches. No separate career totals or
// notification flags are stored, and historical trades are never re-simulated.
export function createCpuCareerAccumulator(){
 const profiles=Object.values(CPU_PROFILES).map(p=>({id:p.id,name:p.name,plays:0,wins:0,debtExits:0,highestFinal:null,pnlTotal:0n,latest:null}));
 function add(record){
  if(record.schemaVersion!==1)throw Error('Unsupported match record version');
  for(const p of record.players){
   if(p.kind!=='cpu')continue;
   const career=profiles.find(c=>c.id===p.cpu);if(!career)continue;
   const wealth=BigInt(p.wealth),initial=BigInt(p.initial),won=wealth>0n&&record.winnerIds.includes(p.id);
   career.plays++;if(won)career.wins++;if(p.status==='debt')career.debtExits++;
   career.pnlTotal+=wealth-initial;
   if(career.highestFinal===null||wealth>career.highestFinal)career.highestFinal=wealth;
   if(!career.latest||later(record,career.latest))career.latest={id:record.id,endedAt:record.endedAt,stage:record.stage,wealth:p.wealth,initial:p.initial,status:p.status,won,tied:won&&record.winnerIds.length>1};
  }
 }
 function result(){return profiles.map(p=>({...p,pnlTotal:String(p.pnlTotal),highestFinal:p.highestFinal===null?null:String(p.highestFinal)}))}
 return {add,result};
}

export function createPersonalBestAccumulator(target){
 const player=self(target);let previousGames=0,highestFinal=null,highestPeak=null;
 function add(record){
  if(record.schemaVersion!==1)throw Error('Unsupported match record version');
  if(!player||record.id===target.id||!later(target,record))return;
  const p=self(record);if(!p)return;
  previousGames++;
  const wealth=BigInt(p.wealth),peak=BigInt(p.peak);
  if(highestFinal===null||wealth>highestFinal)highestFinal=wealth;
  if(highestPeak===null||peak>highestPeak)highestPeak=peak;
 }
 function result(){
  const events=[];
  if(player)for(const [key,title,value,previous] of [['highestFinal','最高最終資産',player.wealth,highestFinal],['highestPeak','最高到達資産',player.peak,highestPeak]]){
   if(previous===null||BigInt(value)>previous)events.push({key,title,value,previousValue:previous===null?null:String(previous),first:previousGames===0});
  }
  return {id:target.id,scope:'self',previousGames,events};
 }
 return {add,result};
}
