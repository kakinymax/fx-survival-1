const {chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core');
const assert=require('node:assert/strict');
const origin='http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:700},extraHTTPHeaders:{'oai-authenticated-user-id':'browser-record-test'}});
 const page=await context.newPage(),errors=[],writes=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',request=>{if(request.method()==='PUT'&&request.url().includes('/api/matches/'))writes.push(JSON.parse(request.postData()))});
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fx-survival-v1')));
 async function seed({solo=false,early=false}={}){
  await page.goto(origin+'/engine.js');
  await page.evaluate(async({solo,early})=>{
   const e=await import('./engine.js'),s=await import('./solo.js'),r=await import('./records.js'),high=n=>n;
   const g=solo?s.createSoloGame('あなた','usdjpy',high):e.createGame(['A','B'],'manual');r.ensureGameIdentity(g,{newGame:true});
   if(solo){s.submitSoloOrder(g,{side:'buy',leverage:1});g.direction='up';g.first=1;g.second=null;g.phase='market-ready';s.resolveSoloRound(g,high);s.commitSoloDecision(g,'fix',high);s.fastForwardSolo(g,high)}
   else {
    while(g.phase==='order')e.submitOrder(g,{side:'buy',leverage:50});g.direction='up';g.first=4;g.phase='market-ready';e.resolveRound(g);
    e.commitDecisions(g,{0:'fix',1:early?'fix':'continue'});
    if(!early){e.submitOrder(g,{side:'buy',leverage:100});g.direction='down';g.first=6;g.second=5;g.phase='market-ready';e.resolveRound(g)}
   }
   localStorage.setItem('fx-survival-v1',JSON.stringify(g));
  },{solo,early});
  await page.goto(origin);
 }
 async function saved(){await page.waitForFunction(()=>document.querySelector('[data-record-status]')?.textContent.includes('保存しました'))}
 await seed();await saved();let g=await state(),record=g.finalRecord;
 assert.equal(record.endedRound,2);assert.equal(record.players[1].metrics.maxRoundLoss,'6250');assert.deepEqual(writes.at(-1),record);assert.equal(g.finalRecordSaved,true);
 assert((await page.locator('.end-surface table').innerText()).includes('−500.0万円'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const count=writes.length;await page.reload();await saved();assert.equal(writes.length,count);assert.deepEqual((await state()).finalRecord,record);
 // The final screen reads only the final snapshot, even if a stale live field changes.
 await page.goto(origin+'/engine.js');await page.evaluate(()=>{const g=JSON.parse(localStorage.getItem('fx-survival-v1'));g.players[0].wealth='999999';g.history[0].results[0].after='999999';localStorage.setItem('fx-survival-v1',JSON.stringify(g))});await page.goto(origin);await saved();assert((await page.locator('.ending').innerText()).includes('125.0万円'));assert.equal(await page.locator('.ending').innerText().then(s=>s.includes('9億')),false);
 await page.locator('[data-action="chart-open"]').click();assert.equal(await page.locator('#chart-rows tr').count(),2);await page.locator('#chart-close').click();
 const status=await page.evaluate(async(record)=>{const response=await fetch('/api/matches/'+record.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...record,endedAt:new Date(Date.parse(record.endedAt)+1000).toISOString()})});return response.status},record);assert.equal(status,409);
 await page.screenshot({path:'/workspace/fx-survival/record-final-mobile.png',fullPage:true});
 // An unavailable API never claims success; the exact unsynced snapshot survives replay.
 await page.route('**/api/matches/*',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"unavailable"}'}));
 await seed({early:true});await page.waitForFunction(()=>document.querySelector('[data-action="retry-record"]'));const failed=(await state()).finalRecord;assert.equal((await state()).finalRecordSaved,undefined);
 await page.reload();await page.waitForFunction(()=>document.querySelector('[data-action="retry-record"]'));assert.deepEqual((await state()).finalRecord,failed);
 await page.locator('[data-action="reset"]').click();assert((await page.locator('#reset-dialog p').innerText()).includes('試合記録を残して'));await page.locator('#reset-confirm').click();assert.equal(await state(),null);assert.equal(await page.locator('[data-pending-records]').count(),1);
 await page.unroute('**/api/matches/*');await page.locator('[data-action="retry-records"]').click();await page.waitForFunction(()=>!document.querySelector('[data-pending-records]'));assert(writes.filter(r=>r.id===failed.id).every(r=>JSON.stringify(r)===JSON.stringify(failed)));
 await page.locator('[data-count="2"]').click();await page.locator('#setup-form button[type="submit"]').click();g=await state();assert(g.gameId);assert(g.startedAt);assert.equal(g.finalRecord,undefined);const beforeCancel=writes.length;await page.locator('[data-action="reset"]').click();assert((await page.locator('#reset-dialog p').innerText()).includes('未完了'));await page.locator('#reset-confirm').click();assert.equal(writes.length,beforeCancel);
 await seed({solo:true});await saved();record=(await state()).finalRecord;assert.equal(record.ownerPlayerId,0);assert.equal(record.players.filter(p=>p.kind==='cpu').length,3);assert.deepEqual(writes.at(-1),record);
 await page.setViewportSize({width:320,height:568});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await page.locator('[data-action="retry-record"]').count(),0);await page.screenshot({path:'/workspace/fx-survival/record-solo-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('PASS: real D1 save, canonical final display/payload, reload without duplicate write, immutable conflict, outage/retry through replay, cancelled-game exclusion, solo fast-forward ownership, mobile UI.');await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
