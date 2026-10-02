import {LEGEND_VERSION,LEGEND_KEYS,playerLegends} from '../dist/legends.js';

export const LEGEND_SCOPES=['self','human','cpu'];
const PAGE_SIZE=20;
const newest=(a,b)=>a.endedAt===b.endedAt?(a.gameId===b.gameId?a.playerId-b.playerId:a.gameId>b.gameId?-1:1):a.endedAt>b.endedAt?-1:1;
const reference=(record,p)=>({gameId:record.id,playerId:p.id,playerName:p.name,kind:p.kind,cpu:p.cpu,stage:record.stage,playMode:record.playMode,endedAt:record.endedAt,initial:p.initial,wealth:p.wealth,peak:p.peak,maxPosition:p.maxPosition,status:p.status});
function encodeCursor(entry,scope,event){return btoa(JSON.stringify({scope,event,endedAt:entry.endedAt,gameId:entry.gameId,playerId:entry.playerId})).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
export function legendQuery(params){
  const scope=params.get('scope')??'self',event=params.get('event')??'all',raw=params.get('cursor');
  if(!LEGEND_SCOPES.includes(scope)||event!=='all'&&!LEGEND_KEYS.includes(event))throw Error('Invalid legend filter');
  let cursor=null;
  if(raw!==null){
    if(!/^[a-zA-Z0-9_-]{1,512}$/.test(raw))throw Error('Invalid legend cursor');
    try{cursor=JSON.parse(atob(raw.replace(/-/g,'+').replace(/_/g,'/')))}catch{throw Error('Invalid legend cursor')}
    if(!cursor||cursor.scope!==scope||cursor.event!==event||typeof cursor.endedAt!=='string'||!Number.isFinite(Date.parse(cursor.endedAt))||new Date(cursor.endedAt).toISOString()!==cursor.endedAt||!/^[-a-zA-Z0-9_]{1,100}$/.test(cursor.gameId??'')||!Number.isInteger(cursor.playerId)||cursor.playerId<0||cursor.playerId>5)throw Error('Invalid legend cursor');
  }
  return {scope,event,cursor};
}

// Receives matches newest first from the existing D1 index. Derived records are
// request-local; pagination bounds the response, never the history being scanned.
export function createLegendAccumulator({scope='self',event='all',cursor=null}={}){
  if(!LEGEND_SCOPES.includes(scope)||event!=='all'&&!LEGEND_KEYS.includes(event))throw Error('Invalid legend filter');
  let totalSavedGames=0,participants=0,matchedResults=0,entries=[],finalized=false;
  const counts=Object.fromEntries(LEGEND_KEYS.map(key=>[key,0])),debts=[];
  function offer(entry){
    if(event!=='all'&&!entry.events.some(e=>e.key===event)||cursor&&newest(entry,cursor)<=0)return;
    const existing=entries.findIndex(other=>other.gameId===entry.gameId&&other.playerId===entry.playerId);
    if(existing>=0)entries[existing]=entry;else entries.push(entry);
    entries.sort(newest);entries=entries.slice(0,PAGE_SIZE+1);
  }
  function add(record){
    if(finalized)throw Error('Legend aggregation already finalized');
    if(record.schemaVersion!==1)throw Error('Unsupported match record version');
    totalSavedGames++;
    const owner=record.players.find(p=>p.id===record.ownerPlayerId);
    if(record.ownerPlayerId!==null&&(!owner||owner.kind!=='human'))throw Error('Invalid owner participant');
    const players=record.players.filter(p=>scope==='self'?p===owner:scope==='human'?p.kind==='human':p.kind==='cpu');
    let gameDebt=0n,debtEntries=[];
    for(const p of players){
      participants++;
      const events=playerLegends(record,p),entry={...reference(record,p),events},debt=-BigInt(p.wealth);
      for(const e of events)counts[e.key]++;
      if(events.length){matchedResults++;offer(entry)}
      if(debt>gameDebt){gameDebt=debt;debtEntries=[entry]}else if(debt>0n&&debt===gameDebt)debtEntries.push(entry);
    }
    if(gameDebt>0n){
      // A newer debt cannot be a strict record if an older debt is as large.
      // This monotonic stack retains every historical record-setting game.
      while(debts.length&&debts.at(-1).value<=gameDebt)debts.pop();
      debts.push({value:gameDebt,entries:debtEntries});
    }
  }
  function result(){
    if(!finalized){
      for(let i=0;i<debts.length;i++)for(const entry of debts[i].entries){
        if(!entry.events.length)matchedResults++;
        counts.debtRecord++;
        offer({...entry,events:[...entry.events,{key:'debtRecord',debt:String(debts[i].value),previous:String(debts[i+1]?.value??0n)}]});
      }
      finalized=true;
    }
    const page=entries.slice(0,PAGE_SIZE),hasMore=entries.length>PAGE_SIZE;
    return {version:LEGEND_VERSION,scope,event,totalSavedGames,participants,matchedResults,counts,filteredResults:event==='all'?matchedResults:counts[event],entries:page,nextCursor:hasMore?encodeCursor(page.at(-1),scope,event):null};
  }
  return {add,result};
}
export function aggregateLegends(records,query={}){
  const stats=createLegendAccumulator(query);
  for(const record of [...records].sort((a,b)=>newest({endedAt:a.endedAt,gameId:a.id,playerId:0},{endedAt:b.endedAt,gameId:b.id,playerId:0})))stats.add(record);
  return stats.result();
}
