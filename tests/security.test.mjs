import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,submitOrder,resolveRound,commitDecisions} from '../dist/engine.js';
import {createSoloGame,submitSoloOrder,resolveSoloRound,commitSoloDecision,fastForwardSolo} from '../dist/solo.js';
import {ensureGameIdentity,validateMatchRecord} from '../dist/records.js';
import {matchView} from '../dist/record-view.js';
import * as api from '../server/api.js';
import {readJsonBody,secureResponse} from '../server/http-security.js';

function record(solo=false){
  const g=solo?createSoloGame('あなた','classic',n=>n):createGame(['A','B']);
  ensureGameIdentity(g,{newGame:true,now:'2026-10-01T00:00:00.000Z',id:()=> 'security-game'});
  if(solo){
    submitSoloOrder(g,{side:'buy',leverage:1});
    Object.assign(g,{direction:'up',first:1,second:null,phase:'market-ready'});resolveSoloRound(g,n=>n);
    commitSoloDecision(g,'fix',n=>n);fastForwardSolo(g,n=>n);
  }
  else{
    while(g.phase==='order')submitOrder(g,{side:'buy',leverage:1});
    Object.assign(g,{direction:'up',first:1,second:null,phase:'market-ready'});resolveRound(g);
    commitDecisions(g,{0:'fix',1:'fix'});
  }
  return ensureGameIdentity(g,{now:'2026-10-02T00:00:00.000Z'}).finalRecord;
}
const headers={'Content-Type':'application/json','oai-authenticated-user-id':'owner'};
const write=(path,value,extra={})=>new Request('https://game.test'+path,{method:'PUT',headers:{...headers,...extra},body:JSON.stringify(value)});

test('write validation rejects persisted display poison, coerced identities, unknown fields and incomplete exits',async()=>{
  const mutations=[
    r=>r.history[0].cpuQuotes={'0':{toString:null}},
    r=>r.id=['security-game'],
    r=>r.stage.id=['classic'],
    r=>r.history[0].decisions=null,
    r=>r.history[0].decisions={'00':'fix','01':'fix'},
    r=>delete r.history[0].decisions['1'],
    r=>r.lastDecisions={round:1,choices:[]},
    r=>r.players[0].id=4,
    r=>r.players[0].kind='cpu',
    r=>r.history[0].cpuQuotes={'0':'x'.repeat(201)},
    r=>r.payload={secret:'unrequested stored data'},
    r=>Object.defineProperty(r,'__proto__',{value:{polluted:true},enumerable:true}),
    r=>r.history[0].results[0].unexpected='payload',
    r=>r.endedAt='invalid'
  ];
  const db={prepare(){assert.fail('rejected inputs must never reach D1')}};
  for(const mutate of mutations){
    const r=structuredClone(record());mutate(r);
    assert.throws(()=>validateMatchRecord(r));
    assert.equal((await api.matchRequest(write('/api/matches/security-game',r),{DB:db})).status,400);
  }
  assert.equal({}.polluted,undefined);
});

test('solo roster, CPU profiles and quote types are checked without changing valid snapshots',()=>{
  const original=record(true),before=JSON.stringify(original);
  assert.strictEqual(validateMatchRecord(original),original);assert.equal(JSON.stringify(original),before);
  for(const mutate of [
    r=>r.players[1].cpu='__proto__',r=>r.players[1].cpu='unknown',
    r=>r.players[2].cpu=r.players[1].cpu,
    r=>{r.playMode='tabletop';r.ownerPlayerId=null},
    r=>r.drawMode='manual',
    r=>r.history[0].cpuQuotes={'1':{toString:null}},
    r=>r.history[0].cpuQuotes={'1':'x'.repeat(201)}
  ]){const r=structuredClone(original);mutate(r);assert.throws(()=>validateMatchRecord(r))}
});

test('stored user text is rendered as text in player names and CPU quotes',()=>{
  const r=record(true);r.players[0].name='<img src=x>';
  r.history[0].cpuQuotes={'1':'<img src=x onerror="window.attacked=1">'};
  validateMatchRecord(r);
  const html=matchView({state:'ready',data:r});
  assert(!html.includes('<img src=x'));assert(html.includes('&lt;img src=x&gt;'));
  assert(html.includes('&lt;img src=x onerror=&quot;window.attacked=1&quot;&gt;'));
  // Previously stored malformed quotes must not prevent reading old matches.
  r.history[0].cpuQuotes={'1':{toString:null}};
  assert.doesNotThrow(()=>matchView({state:'ready',data:r}));
});

test('all API readers and writers reject unauthenticated access before any database call',async()=>{
  const db={prepare(){assert.fail('unauthenticated request touched D1')}};
  for(const [handler,path] of [
    [api.statisticsRequest,'/api/statistics'],[api.cpuCareersRequest,'/api/cpu-careers'],
    [api.personalBestsRequest,'/api/matches/security-game/bests'],[api.recordsRequest,'/api/records'],
    [api.modesRequest,'/api/modes'],[api.legendsRequest,'/api/legends'],
    [api.tripsRequest,'/api/trips'],[api.matchRequest,'/api/matches/security-game']
  ])assert.equal((await handler(new Request('https://game.test'+path),{DB:db})).status,401);
  for(const [handler,path,value] of [[api.matchRequest,'/api/matches/security-game',record()],[api.tripsRequest,'/api/trips/a',{action:'reset',expectedRevision:0,requestId:'reset'}]]){
    assert.equal((await handler(write(path,value,{'oai-authenticated-user-id':''}),{DB:db})).status,401);
    assert.equal((await handler(write(path,value,{'Sec-Fetch-Site':'cross-site'}),{DB:db})).status,403);
    assert.equal((await handler(write(path,value,{Origin:'null'}),{DB:db})).status,403);
    assert.equal((await handler(write(path,value,{'Content-Type':'application/jsonp'}),{DB:db})).status,415);
  }
});

test('JSON streaming handles byte limits, malformed UTF-8, failed reads and stalled clients safely',async()=>{
  const request=body=>new Request('https://game.test/api/trips/a',{method:'PUT',headers,body,duplex:'half'});
  assert.deepEqual(await readJsonBody(request('{}'),2),{value:{}});
  assert.deepEqual(await readJsonBody(request('{}'),1),{status:413,error:'Body too large'});
  assert.equal((await readJsonBody(request(new Uint8Array([123,34,120,34,58,34,255,34,125])),30)).status,400);
  const failure=new ReadableStream({start(c){c.error(Error('sensitive-input-sentinel'))}});
  const response=await api.tripsRequest(request(failure),{});
  assert.equal(response.status,400);assert(!(await response.text()).includes('sensitive-input-sentinel'));
  let cancelled=false;
  const stalled=new ReadableStream({cancel(){cancelled=true;return new Promise(()=>{})}});
  assert.deepEqual(await readJsonBody(request(stalled),10,{timeoutMs:20}),{status:408,error:'Request timed out'});
  assert.equal(cancelled,true);
  const oversized=new ReadableStream({start(c){c.enqueue(new Uint8Array(10))},cancel(){return new Promise(()=>{})}});
  assert.equal((await readJsonBody(request(oversized),2,{timeoutMs:100})).status,413);
  const malformed=await api.tripsRequest(request('{"secret-sentinel":'),{});
  assert.equal(malformed.status,400);assert(!(await malformed.text()).includes('secret-sentinel'));
});

test('defensive headers cover success and error responses while preserving private cache policy',async()=>{
  for(const status of [200,400,401,404,405,413,503]){
    const response=secureResponse(Response.json({status},{status,headers:{'Cache-Control':'no-store'}}));
    assert.equal(response.status,status);assert.equal(response.headers.get('Cache-Control'),'no-store');
    assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
    assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');
    const policy=response.headers.get('Content-Security-Policy');
    assert(policy.includes("script-src 'self'"));assert(!policy.includes("'unsafe-eval'"));
    assert(policy.includes("frame-ancestors 'self'"));assert.deepEqual(await response.json(),{status});
  }
});
