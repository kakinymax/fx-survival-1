import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {aggregateTrips,tripSettings,validateTripChange} from '../server/trips.js';
import {readTrips,changeTrip,readStatistics} from '../server/database.js';
import {tripsRequest} from '../server/api.js';
import {tripsView} from '../dist/trip-view.js';

const start='2026-10-02T10:00:00.000Z',later='2026-10-02T11:00:00.000Z';
function record(id,wealth='1250',options={}){
  return {schemaVersion:1,id,endedAt:options.endedAt??later,stage:{id:'classic',name:'クラシック'},playMode:'solo',drawMode:'auto',maxRounds:12,endedRound:1,ownerPlayerId:0,winnerIds:options.winnerIds??[0],history:[{round:1,results:[{id:0,after:wealth,pnl:String(BigInt(wealth)-1000n),leverage:50}]}],players:[{id:0,name:'あなた',kind:'human',cpu:null,initial:'1000',wealth,peak:'1250',maxPosition:'50000',status:'fixed',...options.player},{id:1,name:'CPU',kind:'cpu',cpu:'gambler',initial:'1000',wealth:'999999999999999999',peak:'999999999999999999',maxPosition:'999999999999999999',status:'fixed'}],...options.record};
}
function database(){
  const sqlite=new DatabaseSync(':memory:');for(const file of ['0000_dusty_wiccan.sql','0001_jazzy_kang.sql','0002_sparkling_invisible_woman.sql'])sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  const calls=[];let transaction=Promise.resolve();
  const db={sqlite,calls,prepare(sql){assert(!sql.includes(';'),'one SQL statement per prepare');return {bind(...args){calls.push({sql,args});return {all:async()=>({success:true,results:sqlite.prepare(sql).all(...args)}),first:async()=>sqlite.prepare(sql).get(...args)??null,run:async()=>{sqlite.prepare(sql).run(...args);return {success:true}}}}}},batch(statements){const result=transaction.then(async()=>{sqlite.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.all());sqlite.exec('COMMIT');return results}catch(error){sqlite.exec('ROLLBACK');throw error}});transaction=result.catch(()=>{});return result}};
  db.seed=(r,owner='owner')=>sqlite.prepare('INSERT INTO matches VALUES (?,?,?,?,?)').run(owner,r.id,r.schemaVersion,r.endedAt,JSON.stringify(r));
  return db;
}
const change=(action,expectedRevision=0,requestId='request',name)=>({action,expectedRevision,requestId,...(action==='rename'?{name}:{})});
test('unstarted meters are distinct, read-only defaults and contain no historical totals',async()=>{
  const db=database();db.seed(record('old'));const before=db.sqlite.prepare('SELECT COUNT(*) AS n FROM trips').get().n,result=await readTrips(db,'owner');
  assert.deepEqual(result.trips.map(t=>[t.id,t.name,t.startedAt,t.revision,t.stats.plays]),[['a','TRIP A',null,0,0],['b','TRIP B',null,0,0]]);assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM trips').get().n,before);assert.equal(db.calls.filter(c=>c.sql.includes('FROM matches')).length,0);
});
test('TRIP uses strict completion boundaries, excludes unassigned people/CPUs and locates the first included game',()=>{
  const rows=[record('before','1250',{endedAt:'2026-10-02T09:59:59.999Z'}),record('equal','1250',{endedAt:start}),record('first','1250',{endedAt:'2026-10-02T10:00:00.001Z'}),record('debt','-4000',{player:{status:'debt'},winnerIds:[]}),record('table','99999',{record:{ownerPlayerId:null,playMode:'tabletop'}})];
  const settings=[{...tripSettings(null,'a'),startedAt:start},{...tripSettings(null,'b'),startedAt:later}],before=JSON.stringify(rows),s=aggregateTrips(rows,settings);
  assert.equal(s.trips[0].stats.plays,2);assert.equal(s.trips[0].stats.wins,1);assert.equal(s.trips[0].stats.initialTotal,'2000');assert.equal(s.trips[0].stats.finalTotal,'-2750');assert.equal(s.trips[0].stats.pnlTotal,'-4750');assert.equal(s.trips[0].stats.debtExits,1);assert.equal(s.trips[0].stats.maxDebt,'4000');assert.equal(s.trips[0].startGameId,'first');assert.equal(s.trips[1].stats.plays,0);assert.equal(s.trips[1].startGameId,null);assert.equal(JSON.stringify(rows),before);
});
test('period metrics include tied wins, zero exits and exact large money, using archived logs without current-rule replay',()=>{
  const rows=[record('tie','500',{winnerIds:[0,1]}),record('cut','0',{player:{status:'cut'},winnerIds:[]}),record('empty','0',{player:{status:'empty'},winnerIds:[]}),record('big','1234567890123456789012345',{player:{peak:'1234567890123456789012345',maxPosition:'123456789012345678901234500'},record:{stage:{id:'retired',name:'旧ルール'}}})],s=aggregateTrips(rows,[{...tripSettings(null,'a'),startedAt:start}]).trips[0].stats;
  assert.equal(s.plays,4);assert.equal(s.wins,2);assert.equal(s.fundsDepleted,2);assert.equal(s.finalTotal,'1234567890123456789012845');assert.equal(s.pnlTotal,'1234567890123456789008845');assert.equal(s.highestFinal,'1234567890123456789012345');assert.equal(s.maxPosition,'123456789012345678901234500');
});
test('real SQL spans all period pages, uses the owner/time index, excludes older history and other accounts',async()=>{
  const db=database();for(let i=0;i<56;i++)db.seed(record('game-'+String(i).padStart(3,'0')));db.seed(record('past','99999',{endedAt:'2026-10-02T09:00:00.000Z'}));db.seed(record('other','99999'),'other');
  await changeTrip(db,'owner','a',change('reset'),start);const result=await readTrips(db,'owner');assert.equal(result.trips[0].stats.plays,56);assert.equal(result.trips[0].stats.initialTotal,'56000');assert.equal(result.trips[0].stats.pnlTotal,'14000');assert.equal(result.trips[0].startGameId,'game-000');assert.equal(result.trips[0].boundaryGameId,'past');assert.equal(result.trips[1].stats.plays,0);
  const reads=db.calls.filter(c=>c.sql.includes('record_json FROM matches'));assert.equal(reads.length,3);assert(reads.every(c=>c.args[0]==='owner'&&c.args[1]===start));
  const plan=db.sqlite.prepare('EXPLAIN QUERY PLAN SELECT game_id,ended_at,record_json FROM matches WHERE owner_id=? AND ended_at>? ORDER BY ended_at DESC,game_id DESC LIMIT 25').all('owner',start);assert(plan.some(p=>p.detail.includes('idx_matches_owner_ended_game')));assert.equal((await readTrips(db,'other')).trips[0].startedAt,null);
});
test('retrying the same reset is idempotent; stale updates and reuse with different content cannot overwrite the period',async()=>{
  const db=database(),op=change('reset');const a=await changeTrip(db,'owner','a',op,start),retry=await changeTrip(db,'owner','a',op,later);assert.equal(a.conflict,false);assert.deepEqual(retry,a);assert.equal(retry.trip.revision,1);assert.equal(retry.trip.startedAt,start);
  const stale=await changeTrip(db,'owner','a',change('reset',0,'other-request'),later);assert.equal(stale.conflict,true);assert.equal(stale.trip.startedAt,start);
  const altered=await changeTrip(db,'owner','a',change('rename',0,'request','different'),later);assert.equal(altered.conflict,true);assert.equal(altered.trip.name,'TRIP A');
  const reused=await changeTrip(db,'owner','a',change('reset',1,'request'),later);assert.equal(reused.conflict,true);assert.equal(reused.trip.startedAt,start);assert.equal(reused.trip.revision,1);
  const renamed=await changeTrip(db,'owner','a',change('rename',1,'rename','今日の10試合'),later);assert.equal(renamed.conflict,false);assert.equal(renamed.trip.startedAt,start);assert.equal(renamed.trip.revision,2);
  const oldReset=await changeTrip(db,'owner','a',op,'2026-10-02T12:00:00.000Z');assert.equal(oldReset.conflict,true);assert.equal(oldReset.trip.startedAt,start);
});
test('two simultaneous updates use compare-and-swap, allowing one change only',async()=>{
  const db=database();await changeTrip(db,'owner','a',change('reset'),start);
  const results=await Promise.all([changeTrip(db,'owner','a',change('rename',1,'first','FIRST'),later),changeTrip(db,'owner','a',change('reset',1,'second'),later)]);
  assert.equal(results.filter(r=>!r.conflict).length,1);assert.equal((await readTrips(db,'owner')).trips[0].revision,2);
});
test('renaming before starting does not start measurement; starting preserves the custom name',async()=>{
  const db=database(),named=await changeTrip(db,'owner','b',change('rename',0,'name-b','練習'),start);assert.equal(named.trip.startedAt,null);assert.equal(named.trip.boundaryGameId,null);
  const started=await changeTrip(db,'owner','b',change('reset',1,'start-b'),later);assert.equal(started.trip.name,'練習');assert.equal(started.trip.startedAt,later);assert.equal((await readTrips(db,'owner')).trips[0].revision,0);
});
test('reset A leaves B and lifelong history unchanged; late uploads from the old interval do not enter A',async()=>{
  const db=database();await changeTrip(db,'owner','a',change('reset',0,'a'),start);await changeTrip(db,'owner','b',change('reset',0,'b'),start);db.seed(record('first'));
  const life=await readStatistics(db,'owner');await changeTrip(db,'owner','a',change('reset',1,'a-reset'),'2026-10-02T12:00:00.000Z');db.seed(record('late-upload','1250',{endedAt:'2026-10-02T10:30:00.000Z'}));
  const trips=await readTrips(db,'owner');assert.equal(trips.trips[0].stats.plays,0);assert.equal(trips.trips[1].stats.plays,2);assert.equal((await readStatistics(db,'owner')).lifetime.plays,life.lifetime.plays+1);assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM matches').get().n,2);
});
test('validation rejects injected boundaries, invalid request/revision/action/name fields',()=>{
  assert.deepEqual(validateTripChange(change('rename',1,'ok','  名前  ')),change('rename',1,'ok','名前'));
  for(const input of [null,[],change('delete'),change('reset',-1),change('reset',1.5),{...change('reset'),requestId:['id']},{...change('reset'),startedAt:start},change('rename',0,'id',' '),change('rename',0,'id','x'.repeat(21))])assert.throws(()=>validateTripChange(input));
});
const request=(path='/api/trips',method='GET',body=null,headers={})=>new Request('https://game.test'+path,{method,headers:{'oai-authenticated-user-id':'owner',...(body?{'content-type':'application/json'}:{}),...headers},...(body?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
test('TRIP API enforces auth, allowed methods/IDs/origin and bounded JSON; GET does not initialize rows',async()=>{
  const db=database();assert.equal((await tripsRequest(new Request('https://game.test/api/trips'),{DB:db})).status,401);const get=await tripsRequest(request(),{DB:db});assert.equal(get.headers.get('Cache-Control'),'no-store');assert.equal((await get.json()).trips.length,2);assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM trips').get().n,0);
  for(const [req,status]of [[request('/api/trips','PUT',change('reset')),405],[request('/api/trips/c','PUT',change('reset')),404],[request('/api/trips/a','POST',change('reset')),405],[request('/api/trips/a','PUT',change('reset'),{origin:'https://other.test'}),403],[request('/api/trips/a','PUT',change('reset'),{'content-type':'text/plain'}),415],[request('/api/trips/a','PUT','x'.repeat(2001)),413],[request('/api/trips/a','PUT',{...change('reset'),startedAt:start}),400]])assert.equal((await tripsRequest(req,{DB:db})).status,status);
  const saved=await tripsRequest(request('/api/trips/a','PUT',change('reset')),{DB:db});assert.equal(saved.status,200);const trip=(await saved.json()).trip;assert.equal(trip.revision,1);assert(Number.isFinite(Date.parse(trip.startedAt)));
  assert.equal((await tripsRequest(request('/api/trips/a','PUT',change('reset',0,'different')),{DB:db})).status,409);
});
test('database/schema failures have recoverable errors and no false default data or acknowledgement',async()=>{
  const previous=console.error;console.error=()=>{};
  try{const bad={prepare(){throw Error('offline')}};assert.equal((await tripsRequest(request(),{DB:bad})).status,503);const save=await tripsRequest(request('/api/trips/a','PUT',change('reset')),{DB:bad});assert.equal(save.status,503);assert.equal((await save.json()).trip,undefined);
    const db=database();await changeTrip(db,'owner','a',change('reset'),start);db.sqlite.prepare('UPDATE trips SET schema_version=2').run();assert.equal((await tripsRequest(request(),{DB:db})).status,503);
  }finally{console.error=previous}
});
test('TRIP views escape custom names, expose only implemented operations and distinguish unstarted/empty/error states',()=>{
  const settings=[{...tripSettings(null,'a'),startedAt:start,name:'<script>bad</script>'},tripSettings(null,'b')],data=aggregateTrips([record('one')],settings),html=tripsView({state:'ready',data});assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert(html.includes('投入元本相当'));assert(html.includes('#match/one?from=trips'));assert(html.includes('TRIP Aをリセット'));assert(html.includes('計測を開始'));assert(html.includes('名前を変更'));assert(html.includes('対面は本人未指定'));
  const failed=tripsView({state:'error',error:'<offline>'});assert(!failed.includes('data-trip='));assert(failed.includes('&lt;offline&gt;'));const empty=tripsView({state:'ready',data:aggregateTrips([],settings)});assert(empty.includes('この期間に終了したCPU対戦はまだありません'));
});
