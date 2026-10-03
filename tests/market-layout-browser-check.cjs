const {chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core');
const assert=require('node:assert/strict');
const origin='http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:320,height:568},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const original=crypto.getRandomValues.bind(crypto);window.randomCalls=0;window.rollQueue=[];
  crypto.getRandomValues=buffer=>{randomCalls++;if(rollQueue.length){buffer[0]=rollQueue.shift();return buffer}return original(buffer)};
 });
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fx-survival-v1')));
 async function seed(stage='classic',direction='up',first=null,second=null,manual=false){
  await page.goto(origin+'/engine.js');
  await page.evaluate(async({stage,direction,first,second,manual})=>{
   const e=await import('./engine.js'),g=e.createGame(['A','B'],'auto',stage);
   e.submitOrder(g,{side:'buy',leverage:25});e.submitOrder(g,{side:'sell',leverage:25});
   e.prepareAutoDraw(g,'direction',()=>direction==='up'?1:2);e.finishAutoDraw(g);
   if(first){e.prepareAutoDraw(g,'first',()=>first);e.finishAutoDraw(g)}
   if(second){e.prepareAutoDraw(g,'second',()=>second);e.finishAutoDraw(g)}
   if(manual){g.mode='manual';g.phase=first===6?'shock':'dice'}
   localStorage.setItem('fx-survival-v1',JSON.stringify(g));
  },{stage,direction,first,second,manual});
  await page.goto(origin);await page.waitForSelector('.market-draw');await page.evaluate(()=>document.fonts.ready);
 }
 async function mobileVisible(manual=false){
  assert.equal(await page.evaluate(()=>scrollY),0);
  const size=page.viewportSize(),limit=manual?size.height:(await page.locator('.turn-actions').boundingBox()).y;
  for(const selector of manual?['.dice-grid','.market-note']:['.market-banner','.market-note']){
   const box=await page.locator(selector).boundingBox();assert(box.y>=0&&box.y+box.height<=limit,`${selector} under viewport/action: ${JSON.stringify({box,limit,size})}`);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 // Every stage uses its existing tables directly on the manual face buttons.
 for(const stage of ['classic','usdjpy','tryjpy']){
  for(const shock of [false,true]){
   await seed(stage,'down',shock?6:null,null,true);const before=await state();
   const values=await page.evaluate(async({stage,shock})=>{const e=await import('./engine.js');return shock?e.STAGES[stage].shock:e.STAGES[stage].normal},{stage,shock});
   assert.equal(await page.locator('[data-face]').count(),6);assert((await page.locator('[data-market-fact="direction"]').innerText()).includes('下落'));
   for(let face=1;face<=6;face++){
    const button=page.locator(`[data-face="${face}"]`),box=await button.boundingBox();assert(box.width>=44&&box.height>=48);
    if(face===6&&!shock){assert.equal(await button.locator('.face-pending').innerText(),'急変判定');assert.equal(await button.locator('.face-rate').count(),0)}
    else{assert.equal(await button.locator('.face-rate').innerText(),values[face-1]/100+'%');if(shock)assert.equal(await button.locator('.face-market').innerText(),face>=4?'ギャップ':'通常')}
   }
   await mobileVisible(true);assert.equal(await page.evaluate(()=>randomCalls),0);assert.deepEqual(await state(),before);
  }
 }
 // Both signs and the normal/gap distinction match the actual saved draw, including a normal result after 6.
 for(const stage of ['classic','usdjpy','tryjpy']){
  for(const direction of ['up','down']){
   for(const [first,second] of [[4,null],[6,1],[6,4],[6,6]]){
    await seed(stage,direction,first,second);const before=await state();
    const m=await page.evaluate(async({first,second,stage})=>(await import('./engine.js')).market(first,second,stage),{first,second,stage});
    assert.equal(await page.locator('.market-banner .big').innerText(),(direction==='up'?'＋':'−')+m.bps/100+'%');
    assert.equal(await page.locator('.market-banner p').innerText(),m.gap?'ギャップ相場':'通常相場');
    assert.equal(await page.locator('.market-banner.gap').count(),m.gap?1:0);
    assert.equal(await page.locator('.market-banner .big.'+(direction==='up'?'positive':'negative')).count(),1);
    assert.equal(await page.locator('[data-action="draw-shock"]').count(),0);assert.equal(await page.locator('[data-action="settle-market"]').count(),1);
    assert.equal(before.history.length,0);await mobileVisible();await page.reload();assert.deepEqual(await state(),before);assert.equal(await page.evaluate(()=>randomCalls),0);
   }
  }
 }
 await seed('tryjpy','up',6);assert.equal(await page.locator('[data-action="draw-shock"]').count(),1);
 assert.equal(await page.locator('[data-action="settle-market"]').count(),0);assert.equal(await page.locator('.market-banner.gap').count(),0);
 assert.equal(await page.locator('.market-banner .big').innerText(),'6');assert((await page.locator('.market-note').innerText()).includes('1〜3なら通常相場'));await mobileVisible();
 // During the existing wait, show only previously revealed facts, never the new die before its result.
 await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>rollQueue=[0]);
 const pending=await state();await page.locator('[data-action="draw-shock"]').click();
 assert.equal((await state()).phase,'drawing');assert.equal(await page.locator('[data-market-fact="direction"]').count(),1);
 assert.equal(await page.locator('[data-market-fact="first"]').innerText(),'第1 6');assert.equal(await page.locator('[data-market-fact="second"]').count(),0);
 assert(await page.locator('[data-action="drawing"]').isDisabled());assert.equal(await page.evaluate(()=>randomCalls),1);
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('fx-survival-v1')).phase==='movement-result');
 assert.equal((await state()).second,1);assert.equal((await state()).direction,pending.direction);assert.deepEqual((await state()).orders,pending.orders);
 assert.equal(await page.locator('.market-banner p').innerText(),'通常相場');
 await seed('classic','down');await page.evaluate(()=>rollQueue=[3]);await page.locator('[data-action="draw-movement"]').click();
 assert.equal((await state()).phase,'drawing');assert.equal(await page.locator('[data-market-fact="direction"]').count(),1);assert.equal(await page.locator('[data-market-fact="first"]').count(),0);
 await page.reload();assert.equal((await state()).phase,'movement-result');assert.equal((await state()).first,4);assert.equal(await page.evaluate(()=>randomCalls),0);
 assert.equal(await page.locator('.market-banner .big').innerText(),'−0.5%');
 // The same manual face click still settles directly; there is no added confirmation step.
 await page.emulateMedia({reducedMotion:'reduce'});await seed('classic','up',6,null,true);
 await page.locator('[data-face="1"]').focus();await page.keyboard.press('Enter');
 const manual=await state();assert.equal(manual.phase,'results');assert.equal(manual.first,6);assert.equal(manual.second,1);
 assert.equal(manual.history[0].gap,false);assert.equal(manual.history[0].bps,100);assert.equal(await page.evaluate(()=>randomCalls),0);
 for(const size of [{width:390,height:600},{width:390,height:844},{width:1280,height:900}]){
  await page.setViewportSize(size);await seed('tryjpy','down',6,null,true);await mobileVisible(true);
  await seed('classic','up',6);await mobileVisible();
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: every stage has exact manual rates and normal/gap labels; signed automatic results including normal after 6; 320/390/1280px; only confirmed facts during existing waits; one draw, reload without reroll, unchanged orders; direct keyboard manual settlement and unchanged action count.');
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
