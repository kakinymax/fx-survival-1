const {chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core');
const assert=require('node:assert/strict');
const origin=process.env.SECURITY_TEST_ORIGIN||'http://127.0.0.1:4173';

(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  try{
    const owner='security-browser-'+Date.now();
    const context=await browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:{'oai-authenticated-user-id':owner}});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const navigation=await page.goto(origin);
    assert(navigation.headers()['content-security-policy'].includes("script-src 'self'"));
    assert.equal(navigation.headers()['x-content-type-options'],'nosniff');
    await page.locator('#setup-form').waitFor();
    const record=await page.evaluate(async()=>{
      const {createGame,submitOrder,resolveRound,commitDecisions}=await import('/engine.js');
      const {ensureGameIdentity}=await import('/records.js');
      const g=createGame(['<img src=x>','B']);ensureGameIdentity(g,{newGame:true});
      while(g.phase==='order')submitOrder(g,{side:'buy',leverage:1});
      Object.assign(g,{direction:'up',first:1,second:null,phase:'market-ready'});resolveRound(g);
      commitDecisions(g,{0:'fix',1:'fix'});ensureGameIdentity(g);
      localStorage.setItem('fx-survival-v1',JSON.stringify(g));return g.finalRecord;
    });
    await page.reload();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('fx-survival-v1')).finalRecordSaved===true);
    assert.equal(await page.locator('img[src="x"]').count(),0);
    assert((await page.locator('.ending').innerText()).includes('<img src=x>'));
    await page.goto(origin+'/#match/'+record.id);await page.locator('.saved-roster').waitFor();
    assert((await page.locator('.saved-roster').innerText()).includes('<img src=x>'));
    assert.equal(await page.locator('img[src="x"]').count(),0);
    const statuses=await page.evaluate(async(record)=>{
      const poison=structuredClone(record);poison.history[0].cpuQuotes={'0':{toString:null}};
      const put=await fetch('/api/matches/'+record.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(poison)});
      const malformed=await fetch('/api/trips/a',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{"secret-sentinel":'});
      const body=await malformed.text();
      const oversized=await fetch('/api/trips/a',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({padding:'x'.repeat(2100)})});
      const missing=await fetch('/api/missing');
      return {poison:put.status,malformed:malformed.status,leaked:body.includes('secret-sentinel'),oversized:oversized.status,missing:missing.status,errorCsp:missing.headers.get('Content-Security-Policy')};
    },record);
    assert.equal(statuses.poison,400);assert.equal(statuses.malformed,400);assert.equal(statuses.leaked,false);
    assert.equal(statuses.oversized,413);assert.equal(statuses.missing,404);assert(statuses.errorCsp);
    const other=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':owner+'-other'}});
    assert.equal((await other.request.get(origin+'/api/matches/'+record.id)).status(),404);
    const anonymous=await browser.newContext();
    assert.equal((await anonymous.request.get(origin+'/api/matches/'+record.id)).status(),401);
    const limiter=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':owner+'-limit'}});
    for(let i=0;i<60;i++)assert.equal((await limiter.request.put(origin+'/api/trips/a',{data:{}})).status(),400);
    const blocked=await limiter.request.put(origin+'/api/trips/a',{data:{}});
    assert.equal(blocked.status(),429);assert(Number(blocked.headers()['retry-after'])>0);
    assert(blocked.headers()['content-security-policy']);
    assert.equal((await limiter.request.get(origin+'/api/matches/'+record.id)).status(),404);
    await page.evaluate(()=>{
      window.securityViolations=[];
      document.addEventListener('securitypolicyviolation',e=>window.securityViolations.push(e.effectiveDirective));
      const script=document.createElement('script');script.textContent='window.inlineExecuted=true';document.body.append(script);
      const external=document.createElement('script');external.src='https://security-example.invalid/attack.js';document.body.append(external);
    });
    await page.waitForFunction(()=>window.securityViolations.length>=2);
    assert.equal(await page.evaluate(()=>window.inlineExecuted),undefined);
    assert.deepEqual(errors,[]);
    console.log('PASS: real Worker/D1 save and read, escaped names, malformed/oversized/poisoned inputs, owner isolation, anonymous rejection, shared write limit/Retry-After, error headers, CSP blocking inline and external scripts.');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
