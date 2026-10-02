const {chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:600}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const state=()=>page.evaluate(()=>localStorage.getItem('fx-survival-v1'));
 async function seed(mode,rounds=8){
  await page.goto('http://127.0.0.1:4173/engine.js');
  await page.evaluate(async({mode,rounds})=>{
   const e=await import('./engine.js'),s=await import('./solo.js'),high=n=>n;
   const g=mode==='solo'?s.createSoloGame('あなた','usdjpy',high):e.createGame(['A','B','C','D'],'manual','usdjpy');
   for(let round=1;round<=rounds;round++){
    if(mode==='solo')s.submitSoloOrder(g,{side:'buy',leverage:1});else while(g.phase==='order')e.submitOrder(g,{side:'buy',leverage:1});
    g.direction=round%2?'up':'down';g.first=round===4?6:1;g.second=round===4?4:null;g.phase='market-ready';
    if(mode==='solo')s.resolveSoloRound(g,high);else e.resolveRound(g);
    if(round<rounds){if(mode==='solo')s.commitSoloDecision(g,'continue',high);else e.commitDecisions(g,Object.fromEntries(e.activePlayers(g).map(p=>[p.id,'continue'])))}
   }
   if(mode!=='solo'&&g.phase==='results')g.decisions={0:'fix'};
   localStorage.setItem('fx-survival-v1',JSON.stringify(g));
  },{mode,rounds});
  await page.goto('http://127.0.0.1:4173');
 }
 async function compact(){
  const row=await page.locator('.result-market-row').boundingBox(),mini=await page.locator('.market-mini-chart').boundingBox();assert(row.height<=50,`market row grew to ${row.height}`);assert.equal(mini.height,48);assert(mini.width>=100&&mini.width<=140);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 for(const mode of ['tabletop','solo']){
  await seed(mode);const before=await state();assert.equal(await page.locator('.market-mini-chart .chart-candle').count(),8);assert.equal(await page.locator('.market-mini-chart .candle-latest').count(),1);assert.equal(await page.locator('.market-mini-chart .candle-gap').count(),1);assert.equal(await page.locator('.market-mini-chart .candle-up').count(),4);assert.equal(await page.locator('.market-mini-chart .candle-down').count(),4);await compact();
  const dock=await page.locator('.turn-actions').boundingBox();await page.screenshot({path:`/workspace/fx-survival/chart-${mode}-mobile.png`});for(const item of await page.locator(mode==='solo'?'.solo-cpu-result>div,.solo-cpu-result p':'.batch-player,.batch-choices').all()){const box=await item.boundingBox();assert(box.y+box.height<=dock.y,JSON.stringify({mode,dock,box}))}
  await page.locator('[data-action="chart-open"]').click();assert.equal(await page.locator('#market-chart').getAttribute('open'),'');assert.equal(await page.locator('#chart-canvas .chart-candle').count(),8);assert.equal(await page.locator('#chart-rows tr').count(),8);assert((await page.locator('#chart-rows tr').nth(3).innerText()).includes('ギャップ'));assert((await page.locator('#chart-current').innerText()).includes('開始 100.00'));assert.equal(await state(),before);
  await page.setViewportSize({width:320,height:568});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const dialog=await page.locator('#market-chart').boundingBox();assert(dialog.x>=0&&dialog.x+dialog.width<=320);assert.equal(await page.locator('.chart-axis').first().evaluate(el=>getComputedStyle(el).fontSize),'14px');await page.screenshot({path:`/workspace/fx-survival/chart-${mode}-expanded.png`});await page.locator('#chart-close').click();assert.equal(await state(),before);await compact();assert.equal(await page.locator('.market-mini-chart').evaluate(el=>document.activeElement===el),true);
  await page.locator('[data-action="chart-open"]').press('Enter');await page.keyboard.press('Escape');assert.equal(await page.locator('#market-chart').getAttribute('open'),null);assert.equal(await state(),before);await page.reload();assert.equal(await page.locator('.market-mini-chart .chart-candle').count(),8);assert.equal(await state(),before);
  await page.setViewportSize({width:390,height:600});
  if(mode==='tabletop'){await page.locator('.settlement-details summary').click();assert((await page.locator('.settlement-dice').innerText()).includes('出目 1'));await page.locator('[data-action="all-continue"]').click();await page.locator('[data-action="commit-decisions"]').click()}else await page.locator('[data-action="solo-continue"]').click();assert.equal(await page.locator('.market-mini-chart').count(),0);
 }
 await seed('solo',12);assert.equal(JSON.parse(await state()).phase,'end');assert.equal(await page.locator('.market-mini-chart .chart-candle').count(),12);await page.locator('[data-action="chart-open"]').click();assert.equal(await page.locator('#chart-rows tr').count(),12);await page.locator('#chart-close').click();await page.setViewportSize({width:1280,height:900});await compact();assert.deepEqual(errors,[]);
 console.log('PASS: compact candle history in tabletop/solo results and final round; latest and gap markers; accurate expanded rows; 320px resize, keyboard and focus; reload and view-only state; no chart on secret input.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
