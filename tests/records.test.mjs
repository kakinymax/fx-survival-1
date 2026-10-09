import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,submitOrder,resolveRound,commitDecisions,activePlayers} from '../dist/engine.js';
import {createSoloGame,submitSoloOrder,resolveSoloRound,commitSoloDecision,fastForwardSolo} from '../dist/solo.js';
import {createMatchRecord,ensureGameIdentity,validateMatchRecord,playerMetrics} from '../dist/records.js';
import {createRecordStore} from '../dist/record-store.js';
import {matchRequest} from '../server/api.js';
import {storeMatch} from '../server/database.js';

const stamp='2026-10-02T10:00:00.000Z';
function identified(g,id='test-game'){return ensureGameIdentity(g,{newGame:true,now:stamp,id:()=>id})}
function round(g,{first=4,second=null,direction='up',leverage=50}={}){
  while(g.phase==='order')submitOrder(g,{side:'buy',leverage});
  g.direction=direction;g.first=first;g.second=second;g.phase='market-ready';resolveRound(g);
}
function finish(g){if(g.phase==='results')commitDecisions(g,Object.fromEntries(activePlayers(g).map(p=>[p.id,'fix'])));ensureGameIdentity(g,{now:stamp});return g.finalRecord}
function memory(){const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}}
function database(){
  const rows=new Map();return {rows,prepare(sql){return {bind(...args){return {async run(){assert(sql.startsWith('INSERT'));const [owner,id,version,date,record]=args,key=JSON.stringify([owner,id]);if(!rows.has(key))rows.set(key,{record_json:record});return {success:true}},async first(){assert(sql.startsWith('SELECT'));return rows.get(JSON.stringify(args))??null}}}}}};
}

test('early exit uses one immutable final snapshot and records exact leverage and drawdown metrics',()=>{
  const g=identified(createGame(['A','B'],'manual'));round(g);commitDecisions(g,{0:'fix',1:'continue'});
  round(g,{first:6,second:5,direction:'down',leverage:100});const r=finish(g);
  assert.strictEqual(g.finalRecord,r);assert.strictEqual(validateMatchRecord(r),r);
  assert.equal(r.endedRound,2);assert.equal(r.maxRounds,12);assert.equal(r.ownerPlayerId,null);assert.deepEqual(r.winnerIds,[0]);
  assert.deepEqual(r.players[0].metrics,{maxLeverage:50,uses100:0,uses50Plus:1,maxRoundProfit:'250',maxRoundLoss:'0',maxDrawdown:'0'});
  assert.deepEqual(r.players[1].metrics,{maxLeverage:100,uses100:1,uses50Plus:2,maxRoundProfit:'250',maxRoundLoss:'6250',maxDrawdown:'6250'});
  assert.equal(r.players[1].wealth,'-5000');assert.equal(r.players[1].peak,'1250');assert.equal(r.players[1].maxPosition,'125000');assert.equal(r.players[1].status,'debt');
  g.players[0].wealth='999';g.history[0].results[0].after='999';assert.equal(r.players[0].wealth,'1250');assert.equal(r.history[0].results[0].after,'1250');
  ensureGameIdentity(g,{now:'2026-10-03T10:00:00.000Z'});assert.strictEqual(g.finalRecord,r);assert.equal(r.endedAt,stamp);
});
test('drawdown is chronological, including recovery; losses and trades are not just peak minus final',()=>{
  const history=[{results:[{id:0,after:'2000',pnl:'1000',leverage:100}]},{results:[{id:0,after:'300',pnl:'-1700',leverage:80}]},{results:[{id:0,after:'2500',pnl:'2200',leverage:49}]}];
  assert.deepEqual(playerMetrics(0,history),{maxLeverage:100,uses100:1,uses50Plus:2,maxRoundProfit:'2200',maxRoundLoss:'1700',maxDrawdown:'1700'});
});
test('normal cut, gap zero, debt and ties have distinct final states; no positive assets means no winner',()=>{
  for(const [leverage,second,status]of [[100,1,'cut'],[50,4,'empty'],[100,5,'debt']]){
    const g=identified(createGame(['A','B'],'manual'));round(g,{first:6,second,direction:'down',leverage});const r=finish(g);
    assert(r.players.every(p=>p.status===status));assert.deepEqual(r.winnerIds,[]);validateMatchRecord(r);
  }
  const g=identified(createGame(['同じ名前','同じ名前']));round(g);const r=finish(g);assert.deepEqual(r.winnerIds,[0,1]);validateMatchRecord(r);
});
test('12 rounds preserve large integer amounts and default settlement, no premature records',()=>{
  const g=identified(createGame(['A','B']));assert.throws(()=>createMatchRecord(g));assert.equal(g.finalRecord,undefined);
  for(let n=1;n<=12;n++){round(g,{first:6,second:6,leverage:100});if(n<12)commitDecisions(g,{0:'continue',1:'continue'})}
  const r=finish(g);validateMatchRecord(r);assert.equal(r.players[0].wealth,String(1000n*11n**12n));assert.equal(r.players[0].metrics.uses100,12);
});
test('legacy starts remain unknown and old log fields are normalized without changing balances',()=>{
  const g=createGame(['A','B'],'manual');round(g);delete g.history[0].stage;delete g.history[0].second;commitDecisions(g,{0:'fix',1:'fix'});
  ensureGameIdentity(g,{now:stamp,id:()=> 'legacy'});assert.equal(g.finalRecord.startedAt,null);validateMatchRecord(g.finalRecord);assert.equal(g.finalRecord.history[0].second,null);
});
test('solo records distinguish CPU profiles and the human; spectator fast-forward still has a complete record',()=>{
  const high=n=>n,g=identified(createSoloGame('あなた','usdjpy',high));submitSoloOrder(g,{side:'buy',leverage:1});g.direction='up';g.first=1;g.second=null;g.phase='market-ready';resolveSoloRound(g,high);commitSoloDecision(g,'fix',high);fastForwardSolo(g,high);
  const r=finish(g);validateMatchRecord(r);assert.equal(r.playMode,'solo');assert.equal(r.ownerPlayerId,0);assert.equal(r.players[0].kind,'human');assert.equal(r.players[0].cpu,null);assert.deepEqual(r.players.slice(1).map(p=>p.kind),['cpu','cpu','cpu']);assert.equal(r.players[0].metrics.maxLeverage,1);assert.equal(r.history.length,r.endedRound);
});
test('record validation rejects altered calculations, metrics, winners and incomplete history',()=>{
  const g=identified(createGame(['A','B']));round(g);const record=finish(g);
  for(const mutate of [r=>r.players[0].wealth='99999',r=>r.players[0].metrics.uses100=2,r=>r.winnerIds=[],r=>r.history[0].bps=100,r=>r.history[0].results[0].after='999',r=>r.endedRound=2]){const r=structuredClone(record);mutate(r);assert.throws(()=>validateMatchRecord(r))}
});
test('Basic rename preserves validation, retries and immutable legacy Classic records',async()=>{
  const g=identified(createGame(['A','B'],'manual'));round(g);const current=finish(g);
  assert.deepEqual(current.stage,{id:'classic',name:'ベーシック'});
  const legacy=structuredClone(current);legacy.stage.name='クラシック';const before=JSON.stringify(legacy);
  assert.strictEqual(validateMatchRecord(legacy),legacy);
  const env={DB:database()},request=record=>new Request(`https://example.test/api/matches/${record.id}`,{method:'PUT',headers:{'Content-Type':'application/json','oai-authenticated-user-id':'owner'},body:JSON.stringify(record)});
  for(let attempt=0;attempt<2;attempt++){
    const response=await matchRequest(request(legacy),env);assert.equal(response.status,200);assert.deepEqual((await response.json()).record,legacy);
  }
  assert.equal(JSON.stringify(legacy),before);
  assert.equal((await matchRequest(request(current),env)).status,409);
  for(const stage of [{id:'classic',name:'不明なステージ'},{id:'usdjpy',name:'クラシック'}]){
    const invalid=structuredClone(current);invalid.stage=stage;assert.throws(()=>validateMatchRecord(invalid));
  }
});
test('D1 writes are immutable, idempotent and partitioned by authenticated owner',async()=>{
  const db=database(),g=identified(createGame(['A','B']));round(g);const r=finish(g);
  assert.equal((await storeMatch(db,'user-a',r)).conflict,false);assert.equal((await storeMatch(db,'user-a',r)).conflict,false);assert.equal(db.rows.size,1);
  const changed={...r,endedAt:'2026-10-03T10:00:00.000Z'};assert.equal((await storeMatch(db,'user-a',changed)).conflict,true);assert.equal((await storeMatch(db,'user-a',r)).record.endedAt,stamp);
  await storeMatch(db,'user-b',changed);assert.equal(db.rows.size,2);
});
test('write API checks authentication, origin, size, identity and validation, and reports database failures',async()=>{
  const g=identified(createGame(['A','B']));round(g);const r=finish(g),db=database();
  const req=(body=r,headers={},path=r.id)=>new Request('https://game.test/api/matches/'+path,{method:'PUT',headers:{'Content-Type':'application/json','oai-authenticated-user-id':'user-a',...headers},body:JSON.stringify(body)});
  assert.equal((await matchRequest(req(r,{'oai-authenticated-user-id':''}),{DB:db})).status,401);
  assert.equal((await matchRequest(req(r,{Origin:'https://other.test'}),{DB:db})).status,403);
  assert.equal((await matchRequest(req(r,{},'different-id'),{DB:db})).status,400);
  assert.equal((await matchRequest(req({padding:'x'.repeat(128001)}),{DB:db})).status,413);
  const response=await matchRequest(req(),{DB:db});assert.equal(response.status,200);assert.deepEqual((await response.json()).record,r);
  assert.equal((await matchRequest(req(),{DB:db})).status,200);assert.equal(db.rows.size,1);
  assert.equal((await matchRequest(req({...r,endedAt:'2026-10-03T10:00:00.000Z'}),{DB:db})).status,409);
  const previous=console.error;console.error=()=>{};try{assert.equal((await matchRequest(req(),{DB:{prepare(){throw Error('unavailable')}}})).status,503)}finally{console.error=previous}
});
test('failed writes remain as drafts across reload/reset; retry verifies the same server snapshot and clears outbox',async()=>{
  const g=identified(createGame(['A','B']));round(g);const r=finish(g),storage=memory();let calls=0;
  const bad=createRecordStore({storage,fetcher:async()=>{calls++;throw Error('offline')}});bad.enqueue(r);await bad.retry(r.id);assert.equal(calls,1);assert.equal(bad.state(r.id),'error');assert.equal(bad.pendingCount(),1);
  let resolve;const fetcher=()=>new Promise(done=>resolve=done),next=createRecordStore({storage,fetcher});const p=next.retry(r.id);assert.strictEqual(next.retry(r.id),p);await Promise.resolve();resolve(Response.json({record:r}));await p;
  assert.equal(next.state(r.id),'saved');assert.equal(next.pendingCount(),0);assert.equal(storage.getItem('fx-survival-pending-records-v1'),null);
  next.enqueue(r,{saved:true});assert.equal(next.pendingCount(),0);
});
test('paused mobile outbox retains exact records across restart and can later use the real sync path',async()=>{
  const g=identified(createGame(['A','B']));round(g);const r=finish(g),storage=memory();let calls=0;
  const fetcher=async()=>{calls++;return Response.json({record:r})};
  const first=createRecordStore({storage,fetcher,autoRetry:false});first.enqueue(r);
  await first.retry(r.id);await first.retryAll();
  assert.equal(calls,0);assert.equal(first.state(r.id),'pending');assert.equal(first.pendingCount(),1);
  assert.deepEqual(JSON.parse(storage.getItem('fx-survival-pending-records-v1')).records,[r]);
  const restart=createRecordStore({storage,fetcher,autoRetry:false});restart.enqueue(r);await restart.retryAll();
  assert.equal(restart.state(r.id),'pending');assert.equal(restart.pendingCount(),1);assert.equal(calls,0);
  const connected=createRecordStore({storage,fetcher});await connected.retryAll();
  assert.equal(calls,1);assert.equal(connected.state(r.id),'saved');assert.equal(connected.pendingCount(),0);
  assert.equal(storage.getItem('fx-survival-pending-records-v1'),null);
});
test('paused outbox reports unavailable draft storage without claiming a successful save',()=>{
  const g=identified(createGame(['A','B']));round(g);const r=finish(g);
  const store=createRecordStore({autoRetry:false,storage:{getItem(){return null},setItem(){throw Error('full')},removeItem(){}}});
  store.enqueue(r);assert.equal(store.state(r.id),'pending');assert.equal(store.draftError(),true);
});
test('mismatched server responses and unavailable draft storage never claim a successful save',async()=>{
  const g=identified(createGame(['A','B']));round(g);const r=finish(g);
  const store=createRecordStore({storage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){}},fetcher:async()=>Response.json({record:{...r,endedRound:9}})});
  store.enqueue(r);await store.retry(r.id);assert.equal(store.state(r.id),'error');assert.equal(store.draftError(),true);
});
test('a synchronous request failure also releases the in-flight slot for retry',async()=>{
  const g=identified(createGame(['A','B']));round(g);const r=finish(g);let tries=0;
  const store=createRecordStore({storage:memory(),fetcher(){if(++tries===1)throw Error('failed');return Promise.resolve(Response.json({record:r}))}});
  store.enqueue(r);await store.retry(r.id);assert.equal(store.state(r.id),'error');await store.retry(r.id);assert.equal(store.state(r.id),'saved');assert.equal(tries,2);
});
