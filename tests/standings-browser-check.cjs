const {chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core');
const assert=require('node:assert/strict');
const origin='http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:320,height:568},reducedMotion:'reduce',extraHTTPHeaders:{'oai-authenticated-user-id':'standings-check-'+Date.now()}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const original=crypto.getRandomValues.bind(crypto);window.randomCalls=0;crypto.getRandomValues=b=>{randomCalls++;return original(b)}});
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fx-survival-v1')));
 async function seed(kind){
  await page.goto(origin+'/engine.js');
  await page.evaluate(async kind=>{
   const e=await import('./engine.js'),s=await import('./solo.js');
   const g=kind==='solo'?s.createSoloGame('あなた','classic',n=>n):e.createGame(['プレイヤーA','プレイヤーB','プレイヤーC','プレイヤーD'],'manual');
   if(kind==='solo'){
    s.submitSoloOrder(g,{side:'buy',leverage:50});Object.assign(g,{direction:'up',first:4,phase:'market-ready'});s.resolveSoloRound(g,n=>n);
   }else{
    while(g.phase==='order')e.submitOrder(g,{side:'buy',leverage:50});
    Object.assign(g,{direction:'up',first:4,phase:'market-ready'});e.resolveRound(g);e.commitDecisions(g,{0:'continue',1:'fix',2:'continue',3:'continue'});
    while(g.phase==='order')e.submitOrder(g,{side:'sell',leverage:100});
    Object.assign(g,{direction:'up',first:4,phase:'market-ready'});e.resolveRound(g);
    if(kind==='end')e.commitDecisions(g,{0:'fix',2:'fix',3:'fix'});
   }
   localStorage.setItem('fx-survival-v1',JSON.stringify(g));
  },kind);
  await page.goto(origin);await page.waitForSelector('.standing-badge');await page.evaluate(()=>document.fonts.ready);
 }
 for(const size of [{width:320,height:568},{width:390,height:600},{width:390,height:844}]){
  await page.setViewportSize(size);await seed('tabletop');
  const before=await state();assert.deepEqual(before.players.map(p=>p.id),[0,1,2,3]);
  assert.deepEqual(await page.locator('.batch-result').evaluateAll(rows=>rows.map(r=>Number(r.dataset.resultPlayer))),[1,0,2,3]);
  assert.deepEqual(await page.locator('.batch-result .standing-badge').allTextContents(),['1位','同率2位','同率2位','同率2位']);
  assert.equal(await page.locator('[data-result-player="1"] [data-result-pnl]').count(),0);
  assert.equal(await page.locator('[data-player="1"][data-decision]').count(),0);
  assert.deepEqual(await page.locator('.public-balance').evaluateAll(rows=>rows.map(r=>Number(r.dataset.standingPlayer))),[1,0,2,3]);
  const dock=await page.locator('.turn-actions').boundingBox(),last=await page.locator('.batch-result').last().boundingBox();
  assert(last.y+last.height<=dock.y,JSON.stringify({size,last,dock}));
  await page.locator('[data-player="0"][data-decision="fix"]').click();
  assert.deepEqual((await state()).players,before.players);assert.deepEqual((await state()).history,before.history);
  assert(await page.locator('[data-player="0"][data-decision="fix"]').evaluate(el=>el===document.activeElement));
  await page.locator('[data-action="all-continue"]').click();await page.locator('[data-action="commit-decisions"]').click();
  assert.equal((await state()).phase,'order');assert((await page.locator('.order-player h1').innerText()).includes('プレイヤーA'));
  assert.equal(await page.locator('.order-player .standing-badge').textContent(),'同率2位');
  const position=await page.locator('.position').boundingBox(),orderDock=await page.locator('.turn-actions').boundingBox();
  assert(position.y+position.height<=orderDock.y,JSON.stringify({size,position,orderDock}));
  await seed('solo');const solo=await state();
  const badge=await page.locator('.solo-human-result .standing-badge').innerText();assert(badge.endsWith('位'));
  const cpuAmounts=await page.locator('.solo-cpu-result [data-result-wealth]').allTextContents();assert.equal(cpuAmounts.length,3);
  const soloLast=await page.locator('.solo-cpu-result').last().boundingBox(),soloDock=await page.locator('.turn-actions').boundingBox();
  assert(soloLast.y+soloLast.height<=soloDock.y,JSON.stringify({size,soloLast,soloDock}));
  await page.reload();assert.deepEqual(await state(),solo);assert.equal(await page.evaluate(()=>randomCalls),0);
  await seed('end');
  assert.deepEqual(await page.locator('[data-final-player]').evaluateAll(rows=>rows.map(r=>Number(r.dataset.finalPlayer))),[1,0,2,3]);
  assert.deepEqual(await page.locator('.final-standings .standing-badge').allTextContents(),['1位','同率2位','同率2位','同率2位']);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const record=(await state()).finalRecord;
  await page.waitForFunction(()=>document.querySelector('[data-record-status]')?.textContent.includes('保存しました'));
  await page.goto(origin+'/#match/'+record.id);await page.waitForSelector('[data-saved-player]');
  assert.equal(await page.locator('[data-saved-player="0"] .standing-badge').textContent(),'同率2位');
  assert.deepEqual((await state()).finalRecord,record);
 }
 await page.setViewportSize({width:390,height:600});await seed('tabletop');await page.screenshot({path:'/tmp/fx-rank-results.png'});
 await seed('end');await page.screenshot({path:'/tmp/fx-rank-final.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: fixed player leads, equal ranks, readonly display sorting and unchanged turn order; 320/390px tabletop/solo/order controls; final and archived standings; reload without extra randomness.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
