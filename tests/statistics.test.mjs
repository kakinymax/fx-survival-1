import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateLifetime} from '../server/statistics.js';
import {readStatistics} from '../server/database.js';
import {statisticsRequest} from '../server/api.js';
import {statisticsView} from '../dist/stats-view.js';

function record(id,wealth='2000',overrides={}){
  const p={id:0,name:'あなた',kind:'human',cpu:null,initial:'1000',wealth,peak:'4000',maxPosition:'200000',status:'fixed',metrics:{maxLeverage:100,uses100:2,uses50Plus:3,maxRoundProfit:'3000',maxRoundLoss:'2000',maxDrawdown:'2000'}};
  return {schemaVersion:1,id,endedAt:'2026-10-02T10:00:00.000Z',stage:{id:'classic',name:'クラシック'},playMode:'solo',maxRounds:12,endedRound:1,ownerPlayerId:0,winnerIds:[0],history:[],players:[{...p,...overrides},{...p,id:1,name:'CPU',kind:'cpu',cpu:'gambler',wealth:'999999999999999999',peak:'999999999999999999',maxPosition:'999999999999999999'}]};
}
function knownRecords(){
  const win=record('win');
  const under=record('under','500',{name:'別の名前',peak:'1000',maxPosition:'49000',metrics:{maxLeverage:49,uses100:0,uses50Plus:0,maxRoundProfit:'0',maxRoundLoss:'500',maxDrawdown:'500'}});
  const cut=record('cut','0',{status:'cut',peak:'5000',maxPosition:'500000',metrics:{maxLeverage:100,uses100:1,uses50Plus:2,maxRoundProfit:'4000',maxRoundLoss:'5000',maxDrawdown:'5000'}});cut.winnerIds=[1];
  const debt=record('debt','-4000',{status:'debt',peak:'1000',maxPosition:'100000',metrics:{maxLeverage:100,uses100:1,uses50Plus:1,maxRoundProfit:'0',maxRoundLoss:'5000',maxDrawdown:'5000'}});debt.winnerIds=[];
  const empty=record('empty','0',{status:'empty',peak:'1000',maxPosition:'50000',metrics:{maxLeverage:50,uses100:0,uses50Plus:1,maxRoundProfit:'0',maxRoundLoss:'1000',maxDrawdown:'1000'}});empty.winnerIds=[];
  const table=record('table','999999999999999999');table.ownerPlayerId=null;table.playMode='tabletop';table.players[0].name='あなた';
  return [win,under,cut,debt,empty,table];
}
test('all requested lifetime metrics use only explicitly associated humans, including negative net wealth and renamed users',()=>{
  const rows=knownRecords(),before=JSON.stringify(rows),stats=aggregateLifetime(rows);
  assert.deepEqual(stats,{totalSavedGames:6,unassignedGames:1,lifetime:{plays:5,wins:2,winRateTenths:400,atOrAboveInitial:1,belowInitial:4,fundsDepleted:2,debtExits:1,initialTotal:'5000',finalTotal:'-1500',pnlTotal:'-6500',averageFinal:'-300',averagePnl:'-1300',highestFinal:'2000',highestPeak:'5000',maxPosition:'500000',maxRoundProfit:'4000',maxRoundLoss:'5000',maxDebt:'4000',maxDrawdown:'5000',maxLeverage:100,uses100:4,uses50Plus:7}});
  assert.equal(JSON.stringify(rows),before);
});
test('ties are whole wins, exact principal counts as retained, zero/debt never become false winners',()=>{
  const r=record('tie','1000');r.winnerIds=[0,1];const s=aggregateLifetime([r]).lifetime;assert.equal(s.wins,1);assert.equal(s.winRateTenths,1000);assert.equal(s.atOrAboveInitial,1);assert.equal(s.pnlTotal,'0');
  assert.equal(aggregateLifetime(knownRecords().slice(2,5)).lifetime.wins,0);
});
test('empty and all-debt histories avoid invented zero bests; averages round symmetrically at ¥1,000',()=>{
  const empty=aggregateLifetime([]).lifetime;assert.equal(empty.plays,0);assert.equal(empty.winRateTenths,null);assert.equal(empty.averageFinal,null);assert.equal(empty.highestFinal,null);assert.equal(empty.pnlTotal,'0');
  const a=record('a','-1',{status:'debt'}),b=record('b','-2',{status:'debt'});a.winnerIds=[];b.winnerIds=[];
  assert.equal(aggregateLifetime([a,b]).lifetime.highestFinal,'-1');assert.equal(aggregateLifetime([a,b]).lifetime.averageFinal,'-2');
  assert.equal(aggregateLifetime([record('c','1'),record('d','2')]).lifetime.averageFinal,'2');
});
test('large money values remain exact beyond Number.MAX_SAFE_INTEGER; all monetary totals are decimal strings',()=>{
  const big='1234567890123456789012345',s=aggregateLifetime([record('a',big),record('b',big)]).lifetime;
  assert.equal(s.finalTotal,String(BigInt(big)*2n));assert.equal(s.pnlTotal,String(BigInt(big)*2n-2000n));assert.equal(s.averageFinal,big);assert.equal(s.highestFinal,big);
});
test('missing historical metrics are derived from stored logs without consulting current stage rules',()=>{
  const r=record('older','300');r.history=[{results:[{id:0,after:'2000',pnl:'1000',leverage:100}]},{results:[{id:0,after:'300',pnl:'-1700',leverage:80}]}];delete r.players[0].metrics;r.stage.id='retired-stage';
  const s=aggregateLifetime([r]).lifetime;assert.equal(s.maxDrawdown,'1700');assert.equal(s.maxRoundLoss,'1700');assert.equal(s.uses100,1);assert.equal(s.uses50Plus,2);
});
test('invalid CPU ownership and unsupported versions fail visibly rather than silently counting incomplete totals',()=>{
  const r=record('cpu');r.ownerPlayerId=1;assert.throws(()=>aggregateLifetime([r]));r.ownerPlayerId=0;r.schemaVersion=99;assert.throws(()=>aggregateLifetime([r]));
});
function pagedDb(rows){
  const calls=[];return {calls,prepare(sql){return {bind(...args){calls.push({sql,args});return {async all(){
    const [owner,date,id]=args;
    const selected=rows.filter(r=>r.owner===owner&&(!date||r.ended_at<date||r.ended_at===date&&r.game_id<id)).sort((a,b)=>a.ended_at===b.ended_at?(a.game_id<b.game_id?1:-1):a.ended_at<b.ended_at?1:-1).slice(0,25);
    return {success:true,results:selected};
  }}}}}};
}
test('all database pages count, timestamps use ID tie-breaks, recent games stay bounded and owner queries stay partitioned',async()=>{
  const rows=[];for(let i=0;i<56;i++){const r=record('game-'+String(i).padStart(3,'0'),'1000');rows.push({owner:'a',game_id:r.id,ended_at:r.endedAt,record_json:JSON.stringify(r)})}
  const alien=record('alien','999999');rows.push({owner:'b',game_id:alien.id,ended_at:alien.endedAt,record_json:JSON.stringify(alien)});
  const db=pagedDb(rows),s=await readStatistics(db,'a');assert.equal(s.lifetime.plays,56);assert.equal(s.lifetime.initialTotal,'56000');assert.equal(s.recentGames.length,10);assert.equal(s.recentGames[0].id,'game-055');assert.equal(s.recentGames.at(-1).id,'game-046');assert.equal(s.recentGames[0].history,undefined);assert.equal(db.calls.length,3);assert(db.calls.every(c=>c.args[0]==='a'));
  const other=await readStatistics(db,'b');assert.equal(other.totalSavedGames,1);assert.equal(other.recentGames[0].id,'alien');
});
test('statistics API rejects anonymous reads, disables cache, and exposes no partial data on database failure',async()=>{
  const db=pagedDb([]),request=headers=>new Request('https://game.test/api/statistics',{headers});
  assert.equal((await statisticsRequest(request({}),{DB:db})).status,401);
  const result=await statisticsRequest(request({'oai-authenticated-user-id':'a'}),{DB:db});assert.equal(result.status,200);assert.equal(result.headers.get('Cache-Control'),'no-store');assert.equal((await result.json()).lifetime.plays,0);
  assert.equal((await statisticsRequest(new Request('https://game.test/api/statistics',{method:'POST',headers:{'oai-authenticated-user-id':'a'}}),{DB:db})).status,405);
  const previous=console.error;console.error=()=>{};
  try{const failed=await statisticsRequest(request({'oai-authenticated-user-id':'a'}),{DB:{prepare(){throw Error('unavailable')}}});assert.equal(failed.status,503);assert.equal((await failed.json()).lifetime,undefined)}finally{console.error=previous}
});
test('statistics view shows the source scope, negative cumulative result and all metrics, and escapes participant names',()=>{
  const rows=knownRecords();rows[0].players[0].name='<script>alert(1)</script>';
  const data={...aggregateLifetime(rows),recentGames:rows},html=statisticsView({state:'ready',data,pendingCount:1});
  assert(html.includes('投入元本相当'));assert(html.includes('最終資産合計'));assert(html.includes('−650.0万円'));assert(html.includes('CPU対戦'));assert(html.includes('試合が1件あります'));assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));
  for(const key of Object.keys(data.lifetime).filter(k=>k!=='winRateTenths'))assert(html.includes(`data-stat="${key}"`),key);
  const unavailable=statisticsView({state:'error',error:'<not available>'});assert(!unavailable.includes('data-stat='));assert(unavailable.includes('再読み込み'));
});
