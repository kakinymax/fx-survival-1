import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {rateLimitRequest,API_LIMITS} from '../server/rate-limit.js';
import {contentSecurityPolicy} from '../server/http-security.js';

const req=(owner='owner-a',method='PUT')=>new Request('https://example.test/api/matches/test',
  {method,headers:owner?{'oai-authenticated-user-id':owner}:{}});
function connect(path=':memory:'){
  const sqlite=new DatabaseSync(path);
  const db={prepare(sql){return {bind(...values){return {async first(){return sqlite.prepare(sql).get(...values)}}}}}};
  return {sqlite,db};
}
function setup(sqlite){sqlite.exec(readFileSync(new URL('../drizzle/0003_late_wallow.sql',import.meta.url),'utf8'))}

test('separate Worker connections share an atomic bounded write counter',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'fx-rate-')),a=connect(join(dir,'shared.db'));setup(a.sqlite);
  const b=connect(join(dir,'shared.db'));
  try{
    const responses=await Promise.all(Array.from({length:API_LIMITS.write+10},(_,i)=>
      rateLimitRequest(req(),i%2?a.db:b.db,{now:61000})));
    assert.equal(responses.filter(r=>r===null).length,API_LIMITS.write);
    const blocked=responses.filter(Boolean);assert.equal(blocked.length,10);
    for(const r of blocked){assert.equal(r.status,429);assert.equal(r.headers.get('Retry-After'),'59');assert.equal(r.headers.get('Cache-Control'),'no-store')}
    assert.equal(a.sqlite.prepare('SELECT requests FROM api_rate_limits').get().requests,61);
    assert.equal(a.sqlite.prepare('SELECT COUNT(*) AS n FROM api_rate_limits').get().n,1);
  }finally{a.sqlite.close();b.sqlite.close();rmSync(dir,{recursive:true,force:true})}
});
test('owners and read/write budgets are isolated; counters reuse rows on a new minute',async()=>{
  const {sqlite,db}=connect();setup(sqlite);
  try{
    for(let i=0;i<60;i++)assert.equal(await rateLimitRequest(req(),db,{now:119999}),null);
    assert.equal((await rateLimitRequest(req(),db,{now:119999})).status,429);
    assert.equal(await rateLimitRequest(req('owner-b'),db,{now:119999}),null);
    for(let i=0;i<120;i++)assert.equal(await rateLimitRequest(req('owner-a','GET'),db,{now:119999}),null);
    assert.equal((await rateLimitRequest(req('owner-a','GET'),db,{now:119999})).status,429);
    assert.equal(await rateLimitRequest(req(),db,{now:120000}),null);
    const row=sqlite.prepare("SELECT * FROM api_rate_limits WHERE owner_id='owner-a' AND scope='write'").get();
    assert.equal(row.window_start,2);assert.equal(row.requests,1);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM api_rate_limits').get().n,3);
  }finally{sqlite.close()}
});
test('a delayed request cannot roll a shared counter back to an earlier minute',async()=>{
  const {sqlite,db}=connect();setup(sqlite);
  try{
    for(let i=0;i<60;i++)await rateLimitRequest(req(),db,{now:120001});
    assert.equal((await rateLimitRequest(req(),db,{now:119999})).status,429);
    assert.equal((await rateLimitRequest(req(),db,{now:120002})).status,429);
    assert.equal(sqlite.prepare('SELECT window_start FROM api_rate_limits').get().window_start,2);
  }finally{sqlite.close()}
});
test('unavailable counters fail closed while unauthenticated requests do not write D1',async()=>{
  const db={prepare(){throw Error('private database error')}};
  assert.equal(await rateLimitRequest(req(null),db),null);
  const response=await rateLimitRequest(req(),db);
  assert.equal(response.status,503);assert.equal(response.headers.get('Retry-After'),'60');
  assert.equal((await response.text()).includes('private database error'),false);
});
test('static and offline documents enforce the Worker CSP without unsupported frame-ancestors',()=>{
  const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
  const meta=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
  assert.equal(meta?.[1],contentSecurityPolicy.replace("; frame-ancestors 'self'",''));
  assert.ok(html.indexOf(meta[0])<html.indexOf('<script'));
});
