import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {aggregateModes} from '../server/modes.js';
import {aggregateLifetime} from '../server/statistics.js';
import {readModes} from '../server/database.js';
import {modesRequest} from '../server/api.js';
import {modesView} from '../dist/mode-view.js';

function record(id,stage='classic',wealth='1250',options={}){
  const p={id:0,name:'あなた',kind:'human',cpu:null,initial:'1000',wealth,peak:'1250',maxPosition:'50000',status:'fixed',metrics:{maxLeverage:50,uses100:0,uses50Plus:1,maxRoundProfit:'250',maxRoundLoss:'0',maxDrawdown:'0'},...options.player};
  return {schemaVersion:1,id,endedAt:'2026-10-02T11:00:00.000Z',stage:{id:stage,name:{classic:'クラシック',usdjpy:'ドル円',tryjpy:'トルコリラ円'}[stage]??stage},ownerPlayerId:0,winnerIds:[0],history:[],players:[p,{...p,id:1,kind:'cpu',name:'CPU',wealth:'999999999999999999',maxPosition:'999999999999999999'}],...options.record};
}
const mode=(data,id)=>data.modes.find(m=>m.stage.id===id).stats;
test('each stage has independent complete stats and agrees with lifetime totals, with CPU and unassigned tabletop excluded',()=>{
  const records=[record('c1'),record('c2','classic','0',{player:{status:'cut'},record:{winnerIds:[1]}}),record('u1','usdjpy','1100'),record('t1','tryjpy','3000'),record('t2','tryjpy','-4000',{player:{status:'debt'},record:{winnerIds:[]}}),record('table','classic','999999',{record:{ownerPlayerId:null,playMode:'tabletop'}})];
  const before=JSON.stringify(records),result=aggregateModes(records),classic=mode(result,'classic'),usd=mode(result,'usdjpy'),try_=mode(result,'tryjpy');
  assert.equal(result.totalSavedGames,6);assert.equal(result.unassignedGames,1);assert.deepEqual(result.lifetime,aggregateLifetime(records).lifetime);
  assert.deepEqual([classic.plays,classic.wins,classic.winRateTenths,classic.pnlTotal,classic.averagePnl,classic.maxGameProfit,classic.maxGameLoss,classic.fundsDepleted],[2,1,500,'-750','-375','250','1000',1]);
  assert.deepEqual([usd.plays,usd.pnlTotal,usd.maxGameProfit,usd.maxGameLoss],[1,'100','100','0']);
  assert.deepEqual([try_.plays,try_.wins,try_.pnlTotal,try_.averagePnl,try_.debtExits,try_.debtRateTenths,try_.maxGameProfit,try_.maxGameLoss],[2,1,'-3000','-1500',1,500,'2000','5000']);
  assert.equal(result.modes.reduce((n,m)=>n+m.stats.plays,0),result.lifetime.plays);assert.equal(result.modes.reduce((n,m)=>n+BigInt(m.stats.pnlTotal),0n),BigInt(result.lifetime.pnlTotal));assert.equal(JSON.stringify(records),before);
});
test('empty modes have null rates/averages/extremes; principal, ties, zero and debt have precise definitions',()=>{
  const empty=aggregateModes([]);assert.deepEqual(empty.modes.map(m=>m.stage.id),['classic','usdjpy','tryjpy']);
  for(const m of empty.modes)for(const key of ['winRateTenths','debtRateTenths','averagePnl','maxGameProfit','maxGameLoss','averageMaxLeverageTenths','averageMaxPosition'])assert.equal(m.stats[key],null,key);
  const tie=record('tie','classic','1000',{record:{winnerIds:[0,1]}}),s=mode(aggregateModes([tie]),'classic');assert.equal(s.winRateTenths,1000);assert.equal(s.pnlTotal,'0');assert.equal(s.maxGameProfit,'0');assert.equal(s.maxGameLoss,'0');assert.equal(s.debtRateTenths,0);
  const zero=record('zero','usdjpy','0',{player:{status:'empty'},record:{winnerIds:[]}});assert.equal(mode(aggregateModes([zero]),'usdjpy').debtExits,0);assert.equal(mode(aggregateModes([zero]),'usdjpy').maxGameLoss,'1000');
});
test('averages use one maximum per game, not one per round; money remains exact and negative halves round away from zero',()=>{
  const a=record('a','classic','999',{player:{maxPosition:'1234567890123456789012345',metrics:{maxLeverage:49}}}),b=record('b','classic','998',{player:{maxPosition:'1234567890123456789012346',metrics:{maxLeverage:50}}});
  a.history=Array.from({length:12},()=>({results:[{id:0,after:'1000',pnl:'0',leverage:49}]}));
  const s=mode(aggregateModes([a,b]),'classic');assert.equal(s.averageMaxLeverageTenths,'495');assert.equal(s.averageMaxPosition,'1234567890123456789012346');assert.equal(s.averagePnl,'-2');assert.equal(s.maxGameProfit,'0');assert.equal(s.maxGameLoss,'2');
  const rows=[record('x'),record('y'),record('z','classic','-1',{player:{status:'debt'},record:{winnerIds:[]}})];assert.equal(mode(aggregateModes(rows),'classic').debtRateTenths,333);
});
test('historical missing metrics use stored logs; unknown stages stay separate and latest archived labels do not depend on visit order',()=>{
  const old=record('old','retired','900',{player:{metrics:undefined},record:{endedAt:'2026-10-01T11:00:00.000Z',stage:{id:'retired',name:'旧ステージ'}}});old.history=[{results:[{id:0,leverage:73,pnl:'-100',after:'900'}]}];
  const fresh=record('new','retired','1200',{record:{stage:{id:'retired',name:'保存済みの名前'}}}),other=record('other','another','1300');
  const records=[old,fresh,other],result=aggregateModes(records);assert.equal(mode(result,'retired').plays,2);assert.equal(mode(result,'retired').averageMaxLeverageTenths,'615');assert.equal(result.modes.find(m=>m.stage.id==='retired').stage.name,'保存済みの名前');assert.deepEqual(result,aggregateModes([...records].reverse()));assert.equal(mode(result,'classic').plays,0);assert.equal(mode(result,'another').plays,1);
});
test('unsupported records and CPU ownership fail without producing misleading partial totals',()=>{
  assert.throws(()=>aggregateModes([record('a'),record('cpu','classic','1000',{record:{ownerPlayerId:1}})]));
  assert.throws(()=>aggregateModes([record('new','classic','1000',{record:{schemaVersion:99}})]));
  assert.throws(()=>aggregateModes([record('missing','classic','1000',{record:{stage:null}})]));
});
function database(){
  const sqlite=new DatabaseSync(':memory:');for(const f of ['0000_dusty_wiccan.sql','0001_jazzy_kang.sql','0002_sparkling_invisible_woman.sql'])sqlite.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
  const calls=[],db={sqlite,calls,prepare(sql){return {bind(...args){calls.push({sql,args});return {all:async()=>({success:true,results:sqlite.prepare(sql).all(...args)})}}}}};
  db.seed=(r,owner='owner')=>sqlite.prepare('INSERT INTO matches VALUES (?,?,?,?,?)').run(owner,r.id,r.schemaVersion,r.endedAt,JSON.stringify(r));return db;
}
test('real indexed SQL spans all pages and equal timestamps, isolates accounts, and performs no writes to records or TRIP settings',async()=>{
  const db=database();for(let i=0;i<56;i++)db.seed(record('game-'+String(i).padStart(3,'0'),['classic','usdjpy','tryjpy'][i%3]));db.seed(record('alien','tryjpy','999999'),'other');
  const before=db.sqlite.prepare('SELECT * FROM matches ORDER BY owner_id,game_id').all(),s=await readModes(db,'owner');assert.equal(s.lifetime.plays,56);assert.deepEqual(s.modes.map(m=>m.stats.plays),[19,19,18]);assert.equal(s.lifetime.pnlTotal,'14000');assert.equal(db.calls.length,3);assert(db.calls.every(c=>c.args[0]==='owner'&&c.sql.startsWith('SELECT')));assert.deepEqual(db.sqlite.prepare('SELECT * FROM matches ORDER BY owner_id,game_id').all(),before);assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM trips').get().n,0);
  assert.equal((await readModes(db,'other')).lifetime.plays,1);
  const plan=db.sqlite.prepare('EXPLAIN QUERY PLAN SELECT game_id,ended_at,record_json FROM matches WHERE owner_id=? ORDER BY ended_at DESC,game_id DESC LIMIT 25').all('owner');assert(plan.some(p=>p.detail.includes('idx_matches_owner_ended_game')));
});
test('read API requires authentication, allows only GET, disables caching, and fails closed on unreadable history',async()=>{
  const request=(headers={})=>new Request('https://game.test/api/modes',{headers}),db=database();
  assert.equal((await modesRequest(request(),{DB:db})).status,401);
  const headers={'oai-authenticated-user-id':'owner'},response=await modesRequest(request(headers),{DB:db});assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal((await response.json()).modes.length,3);
  assert.equal((await modesRequest(new Request('https://game.test/api/modes',{method:'PUT',headers}),{DB:db})).status,405);
  const previous=console.error;console.error=()=>{};try{const fail=await modesRequest(request(headers),{DB:{prepare(){throw Error('unavailable')}}});assert.equal(fail.status,503);assert.equal((await fail.json()).modes,undefined)}finally{console.error=previous}
});
test('comparison view exposes all required metrics, handles empty/error/pending states, and escapes archived names/IDs',()=>{
  const r=record('unsafe','<stage>');r.stage.name='<script>alert(1)</script>';const data=aggregateModes([r]),html=modesView({state:'ready',data,pendingCount:1,hasGame:true});
  assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert(html.includes('&lt;stage&gt;'));assert(html.includes('本人未指定'));assert(html.includes('ゲームに戻る'));assert(html.includes('保存を再試行'));
  for(const key of ['plays','pnlTotal','averagePnl','winRate','debtRate','fundsDepleted','maxGameProfit','maxGameLoss','averageMaxLeverage','averageMaxPosition'])assert(html.includes(`data-mode-stat="${key}"`),key);
  assert(html.includes('このモードの記録はまだありません'));assert(html.includes('aria-current="page"'));assert(modesView({state:'error',error:'<unavailable>'}).includes('&lt;unavailable&gt;'));assert(modesView({state:'loading'}).includes('role="status"'));
});
