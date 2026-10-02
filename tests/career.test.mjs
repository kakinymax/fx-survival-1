import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createCpuCareerAccumulator,createPersonalBestAccumulator} from '../server/career.js';
import {readCpuCareers,readPersonalBests,readStatistics} from '../server/database.js';
import {cpuCareersRequest,personalBestsRequest} from '../server/api.js';
import {cpuCareersView,cpuPreviousQuote,personalBestsView} from '../dist/career-view.js';

function record(id,{wealth='1250',peak=wealth,date='2026-10-02T12:00:00.000Z',cpuWealth='900',cpuStatus='fixed',winners=[0]}={}){
 const metric={maxLeverage:1,uses100:0,uses50Plus:0,maxRoundProfit:'0',maxRoundLoss:'0',maxDrawdown:'0'};
 return {schemaVersion:1,id,endedAt:date,stage:{id:'classic',name:'クラシック'},playMode:'solo',ownerPlayerId:0,winnerIds:winners,history:[],players:[
  {id:0,name:'あなた',kind:'human',cpu:null,initial:'1000',wealth,peak,maxPosition:'1000',status:BigInt(wealth)<0n?'debt':'fixed',metrics:metric},
  {id:1,name:'旧CPU名',kind:'cpu',cpu:'steady',initial:'1000',wealth:cpuWealth,peak:'1000',maxPosition:'1000',status:cpuStatus,metrics:metric}
 ]};
}
function database(){
 const sqlite=new DatabaseSync(':memory:');for(const f of ['0000_dusty_wiccan.sql','0001_jazzy_kang.sql'])sqlite.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 const calls=[],db={sqlite,calls,prepare(sql){assert(!sql.includes(';'));return {bind(...args){calls.push({sql,args});return {all:async()=>({success:true,results:sqlite.prepare(sql).all(...args)}),first:async()=>sqlite.prepare(sql).get(...args)??null}}}}};
 db.seed=(r,owner='owner')=>sqlite.prepare('INSERT INTO matches VALUES (?,?,?,?,?)').run(owner,r.id,r.schemaVersion,r.endedAt,JSON.stringify(r));return db;
}
const cpu=rows=>{const c=createCpuCareerAccumulator();rows.forEach(r=>c.add(r));return c.result()};
const best=(target,rows)=>{const c=createPersonalBestAccumulator(target);rows.forEach(r=>c.add(r));return c.result()};

test('CPU careers use stable personality IDs, actual wins/debt and exact stored PnL, never human names',()=>{
 const a=record('a',{cpuWealth:'1500',winners:[0,1]}),b=record('b',{cpuWealth:'-4000',cpuStatus:'debt',winners:[]});
 b.players[0].name='堅実派';b.players[0].cpu='steady';a.players[1].name='変更前';
 const unknown=record('unknown');unknown.players[1].cpu='future-personality';
 const rows=[b,unknown,a],before=JSON.stringify(rows),data=cpu(rows),steady=data.find(c=>c.id==='steady');
 assert.equal(steady.name,'堅実派');assert.equal(steady.plays,2);assert.equal(steady.wins,1);assert.equal(steady.debtExits,1);assert.equal(steady.highestFinal,'1500');assert.equal(steady.pnlTotal,'-4500');assert.equal(steady.latest.id,'b');assert.equal(steady.latest.status,'debt');
 assert.equal(data.find(c=>c.id==='rival').plays,0);assert.equal(data.find(c=>c.id==='rival').highestFinal,null);assert.equal(JSON.stringify(rows),before);
 const huge='1234567890123456789012345',big=cpu([record('huge',{cpuWealth:huge})])[0];assert.equal(big.highestFinal,huge);assert.equal(big.pnlTotal,String(BigInt(huge)-1000n));
 const negative=cpu([record('negative',{cpuWealth:'-1',cpuStatus:'debt',winners:[1]})])[0];assert.equal(negative.highestFinal,'-1');assert.equal(negative.wins,0);
});
test('CPU latest game follows completion date and ID across stages, rather than upload order or old names',()=>{
 const older=record('z',{date:'2026-10-02T11:00:00.000Z'}),a=record('a'),b=record('b');b.stage={id:'retired',name:'旧ステージ'};
 assert.equal(cpu([b,older,a])[0].latest.id,'b');assert.equal(cpu([b,older,a])[0].latest.stage.name,'旧ステージ');
 assert.throws(()=>cpu([{...b,schemaVersion:99}]));
});
test('personal bests exclude the target, future games, ties, CPU values and unassigned tabletop participants',()=>{
 const previous=record('a',{wealth:'1250',peak:'2000'}),target=record('b',{wealth:'1500',peak:'2000'}),future=record('z',{wealth:'999999',peak:'999999'}),table=record('table',{wealth:'99999',date:'2026-10-02T10:00:00.000Z'});table.playMode='tabletop';table.ownerPlayerId=null;
 previous.players[0].name='以前の名前';const rows=[future,target,table,previous],before=JSON.stringify(rows),result=best(target,rows);
 assert.equal(result.previousGames,1);assert.deepEqual(result.events,[{key:'highestFinal',title:'最高最終資産',value:'1500',previousValue:'1250',first:false}]);assert.equal(JSON.stringify(rows),before);
 assert.deepEqual(best(previous,[previous]).events.map(e=>[e.first,e.previousValue]),[[true,null],[true,null]]);
 assert.deepEqual(best(table,rows).events,[]);
 target.players[0].wealth='1250';assert.deepEqual(best(target,rows).events,[]);
});
test('peak updates remain distinct from final results, including debt, all-negative bests and huge amounts',()=>{
 const old=record('a',{wealth:'1250',peak:'2000'}),debt=record('b',{wealth:'-44000',peak:'11000',winners:[]});
 assert.deepEqual(best(debt,[old,debt]).events.map(e=>e.key),['highestPeak']);
 const negative=record('a',{wealth:'-4000',peak:'1000'}),lessDebt=record('b',{wealth:'-1000',peak:'1000'});assert.equal(best(lessDebt,[negative]).events[0].previousValue,'-4000');
 const big='1234567890123456789012345',large=record('b',{wealth:big,peak:big});assert.equal(best(large,[old]).events[0].value,big);
});
test('real database pages aggregate all CPU games and prior bests while isolating owners and retaining the existing index',async()=>{
 const db=database();for(let i=0;i<56;i++)db.seed(record('game-'+String(i).padStart(3,'0')));
 const target=record('target',{wealth:'2000',peak:'2500',date:'2026-10-02T13:00:00.000Z'});db.seed(target);db.seed(record('other',{wealth:'99999',cpuWealth:'99999'}),'other');
 const before=db.sqlite.prepare('SELECT COUNT(*) AS n FROM matches').get().n,data=await readCpuCareers(db,'owner');assert.equal(data.cpuCareers[0].plays,57);assert.equal(data.cpuCareers[0].pnlTotal,'-5700');assert.equal(data.cpuCareers[0].latest.id,'target');assert.equal(db.calls.length,3);assert(db.calls.every(c=>c.args[0]==='owner'));
 const bests=await readPersonalBests(db,'owner','target');assert.equal(bests.previousGames,56);assert.equal(bests.events.length,2);assert.equal(bests.events[0].previousValue,'1250');assert.equal(await readPersonalBests(db,'other','target'),null);assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM matches').get().n,before);
 assert.deepEqual((await readStatistics(db,'owner')).cpuCareers,data.cpuCareers);
 assert(db.sqlite.prepare('EXPLAIN QUERY PLAN SELECT game_id,ended_at,record_json FROM matches WHERE owner_id=? ORDER BY ended_at DESC,game_id DESC LIMIT 25').all('owner').some(p=>p.detail.includes('idx_matches_owner_ended_game')));
});
test('new read APIs enforce identity, method, ownership and no-cache, with recoverable failures',async()=>{
 const db=database();db.seed(record('game'));const req=(path,method='GET',owner='owner')=>new Request('https://game.test'+path,{method,headers:owner?{'oai-authenticated-user-id':owner}:{}});
 for(const [handler,path] of [[cpuCareersRequest,'/api/cpu-careers'],[personalBestsRequest,'/api/matches/game/bests']]){
  assert.equal((await handler(req(path,'GET',null),{DB:db})).status,401);assert.equal((await handler(req(path,'PUT'),{DB:db})).status,405);
  const res=await handler(req(path),{DB:db});assert.equal(res.status,200);assert.equal(res.headers.get('Cache-Control'),'no-store');
  const log=console.error;console.error=()=>{};try{const failed=await handler(req(path),{DB:{prepare(){throw Error('offline')}}});assert.equal(failed.status,503);assert.equal((await failed.json()).events,undefined)}finally{console.error=log}
 }
 assert.equal((await personalBestsRequest(req('/api/matches/game/bests','GET','other'),{DB:db})).status,404);assert.equal((await personalBestsRequest(req('/api/matches/bad/id/bests'),{DB:db})).status,404);
});
test('previous-game reactions are factual for bankruptcy, principal loss, unchanged principal, gains and tied wins',()=>{
 const career=cpu([])[0];assert(cpuPreviousQuote(career).includes('はじめて'));
 const latest=(overrides={})=>({...career,latest:{wealth:'900',initial:'1000',status:'fixed',won:false,tied:false,...overrides}});
 assert(cpuPreviousQuote(latest()).includes('元本割れ'));assert(cpuPreviousQuote(latest({wealth:'1000'})).includes('元本を残して'));
 assert(cpuPreviousQuote(latest({wealth:'1500'})).includes('150.0万円'));assert(cpuPreviousQuote(latest({wealth:'500',won:true,tied:true})).includes('50.0万円で同率優勝'));
 assert(cpuPreviousQuote(latest({wealth:'-4000',status:'debt'})).includes('負債退場'));for(const status of ['cut','empty'])assert(cpuPreviousQuote(latest({wealth:'0',status})).includes('資金が尽きて'));
 const html=cpuCareersView(cpu([]));assert(html.includes('<summary>CPUの戦績'));assert(!html.includes('<details class="cpu-careers" open'));assert(html.includes('data-cpu-stat="highestFinal">—'));assert(!html.includes('data-stat='));
 assert.equal(personalBestsView({events:[]}), '');const first=personalBestsView(best(record('first',{wealth:'-4000',peak:'1000'}),[]));assert(first.includes('初記録'));assert(first.includes('class="negative"'));assert(!first.includes('勝利'));
 const escaped=personalBestsView({events:[{key:'<key>',title:'<script>',value:'1250',previousValue:'1000',first:false}]});assert(!escaped.includes('<script>'));assert(escaped.includes('&lt;script&gt;'));assert(escaped.includes('これまで 100.0万円'));
});
