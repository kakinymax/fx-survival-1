const {chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core');
const assert=require('node:assert/strict');
const origin='http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:320,height:568}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const original=crypto.getRandomValues.bind(crypto);window.rollQueue=[];window.randomCalls=0;
  crypto.getRandomValues=buffer=>{randomCalls++;if(rollQueue.length){buffer[0]=rollQueue.shift();return buffer}return original(buffer)};
 });
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fx-survival-v1')));
 const wait=phase=>page.waitForFunction(p=>JSON.parse(localStorage.getItem('fx-survival-v1')).phase===p,phase);
 async function seed({stage='classic',direction='up',first=6,solo=false,spectating=false,historyRounds=3}={}){
  await page.goto(origin+'/engine.js');
  await page.evaluate(async({stage,direction,first,solo,spectating,historyRounds})=>{
   const e=await import('./engine.js'),s=await import('./solo.js');
   const g=solo?s.createSoloGame('あなた',stage,n=>n):e.createGame(['A','B'],'auto',stage);
   const orders=leverage=>{if(solo)s.submitSoloOrder(g,{side:'buy',leverage});else{e.submitOrder(g,{side:'buy',leverage});e.submitOrder(g,{side:'sell',leverage})}};
   for(let i=0;i<historyRounds;i++){
    orders(1);e.prepareAutoDraw(g,'direction',()=>i%2?2:1);e.finishAutoDraw(g);
    e.prepareAutoDraw(g,'first',()=>1);e.finishAutoDraw(g);
    if(solo){s.resolveSoloRound(g,n=>n);s.commitSoloDecision(g,'continue',n=>n)}
    else{e.resolveRound(g);e.commitDecisions(g,{0:'continue',1:'continue'})}
   }
   orders(25);
   if(spectating)g.players[0].status='fixed';
   e.prepareAutoDraw(g,'direction',()=>direction==='up'?1:2);e.finishAutoDraw(g);
   if(first){e.prepareAutoDraw(g,'first',()=>first);e.finishAutoDraw(g)}
   localStorage.setItem('fx-survival-v1',JSON.stringify(g));
  },{stage,direction,first,solo,spectating,historyRounds});
  await page.goto(origin);await page.waitForSelector('.market-draw');await page.evaluate(()=>document.fonts.ready);
 }
 async function visible(){
  const dock=await page.locator('.turn-actions').boundingBox();
  for(const selector of ['.market-banner','.market-note']){
   if(!await page.locator(selector).count())continue;
   const box=await page.locator(selector).boundingBox();assert(box.y>=0&&box.y+box.height<=dock.y,JSON.stringify({selector,box,dock}));
  }
  assert.equal(await page.evaluate(()=>scrollY),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 // Sample real animation frames: the open stays fixed and the body only grows in the drawn direction.
 for(const direction of ['up','down'])for(const second of [1,6]){
  await seed({stage:'tryjpy',direction});assert.equal(await page.locator('.market-current-candle').count(),0);
  assert.equal(await page.locator('.market-history-candle').count(),3);
  const oldGeometry=await page.locator('.market-history-candle').evaluateAll(cs=>cs.map(c=>c.outerHTML));
  const before=await state();await page.evaluate(n=>rollQueue=[n-1],second);
  await page.locator('[data-action="draw-shock"]').click();
  assert.equal((await state()).second,second);assert.equal((await state()).phase,'drawing');
  assert.equal(await page.locator('[data-market-fact="second"]').count(),0);
  assert.equal(await page.locator('.market-banner.gap').count(),0);
  assert(!(await page.locator('.candle-summary').innerText()).includes('%'));await visible();
  assert.deepEqual(await page.locator('.market-history-candle').evaluateAll(cs=>cs.map(c=>c.outerHTML)),oldGeometry);
  const samples=[];
  for(const progress of [150,450,750]){
   await page.waitForFunction(t=>document.querySelector('.shock-body')?.getAnimations()[0]?.currentTime>=t,progress);
   samples.push(await page.evaluate(()=>{
    const svg=document.querySelector('.market-history-chart'),body=svg.querySelector('.shock-body'),box=body.getBoundingClientRect();
    const open=new DOMPoint(0,Number(body.dataset.openY)).matrixTransform(svg.getScreenCTM()).y;
    const close=new DOMPoint(0,Number(body.dataset.closeY)).matrixTransform(svg.getScreenCTM()).y;
    return {top:box.top,bottom:box.bottom,height:box.height,open,close};
   }));
  }
  assert(samples[0].height<samples[1].height&&samples[1].height<samples[2].height);
  for(const frame of samples){
   assert(Math.abs((direction==='up'?frame.bottom:frame.top)-frame.open)<.1);
   assert(frame.top>=Math.min(frame.open,frame.close)-.1&&frame.bottom<=Math.max(frame.open,frame.close)+.1);
  }
  await wait('movement-result');const drawn=await state();
  assert.equal(await page.locator('.shock-candle-animated').count(),0);assert.equal(await page.evaluate(()=>randomCalls),1);
  assert.equal(await page.locator('.market-banner .big').innerText(),(direction==='up'?'＋':'−')+(second===1?'2':'20')+'%');
  assert.equal(await page.locator('.market-banner p').innerText(),second===1?'通常相場':'ギャップ相場');await visible();
  assert.deepEqual(drawn.orders,before.orders);assert.deepEqual(drawn.players,before.players);assert.deepEqual(drawn.history,before.history);
  assert.deepEqual(await page.locator('.market-history-candle').evaluateAll(cs=>cs.map(c=>c.outerHTML)),oldGeometry);
  const joins=await page.locator('.market-current-candle').evaluate(c=>({open:Number(c.dataset.open),previous:Number([...document.querySelectorAll('.market-history-candle')].at(-1).dataset.close)}));
  assert.equal(joins.open,joins.previous);
 }
 // Reload restores the saved outcome immediately, without replaying or rerolling it.
 await seed({direction:'down'});await page.evaluate(()=>rollQueue=[4]);await page.locator('[data-action="draw-shock"]').click();
 await page.reload();await wait('movement-result');assert.equal((await state()).second,5);
 assert.equal(await page.evaluate(()=>randomCalls),0);assert.equal(await page.locator('.shock-candle-animated').count(),0);
 assert.equal(await page.locator('.market-banner .big').innerText(),'−5%');
 await page.locator('[data-action="settle-market"]').click();let settled=await state();
 assert.equal(settled.history.length,4);assert.equal(settled.history.at(-1).bps,500);assert.equal(settled.history.at(-1).gap,true);
 assert.equal(await page.locator('.market-mini-chart .chart-candle').count(),4);
 await page.reload();assert.deepEqual(await state(),settled);
 // Reduced motion presents the same candle and result with no 1-second wait.
 await page.emulateMedia({reducedMotion:'reduce'});await seed();await page.evaluate(()=>rollQueue=[0]);
 const started=Date.now();await page.locator('[data-action="draw-shock"]').click();await wait('movement-result');assert(Date.now()-started<650);
 assert.equal(await page.locator('.market-current-candle').count(),1);assert.equal(await page.locator('.shock-body').evaluate(el=>el.getAnimations().length),0);
 // Ordinary first dice add a candle immediately on revelation, with no body animation.
 await page.emulateMedia({reducedMotion:'no-preference'});await seed({first:null});await page.evaluate(()=>rollQueue=[3]);
 await page.locator('[data-action="draw-movement"]').click();assert.equal(await page.locator('.market-current-candle').count(),0);
 await wait('movement-result');assert.equal((await state()).first,4);assert.equal(await page.locator('.market-current-candle').count(),1);
 assert.equal(await page.locator('.shock-body').evaluate(el=>el.getAnimations().length),0);
 // Returning from another route resumes the elapsed animation, rather than starting a new one.
 await seed();await page.evaluate(()=>rollQueue=[5]);await page.locator('[data-action="draw-shock"]').click();
 await page.evaluate(()=>location.hash='stats');await page.waitForFunction(()=>document.body.dataset.phase==='statistics');
 await page.evaluate(()=>location.hash='');await page.waitForSelector('.market-history-chart');
 assert((await page.locator('.market-history-chart').getAttribute('style')).match(/--shock-delay:-[1-9]/));
 await wait('movement-result');assert.equal(await page.evaluate(()=>randomCalls),1);
 // Reset and solo fast-forward during the candle never restore an obsolete game.
 await seed();await page.evaluate(()=>rollQueue=[5]);await page.locator('[data-action="draw-shock"]').click();
 await page.locator('[data-action="reset"]').click();await page.locator('#reset-confirm').click();await page.waitForTimeout(1100);
 assert.equal(await state(),null);assert.equal(await page.locator('#setup-form').count(),1);
 await seed({solo:true,spectating:true});await page.evaluate(()=>rollQueue=[5]);await page.locator('[data-action="draw-shock"]').click();
 await page.locator('[data-action="fast-forward"]').click();await wait('end');settled=await state();await page.waitForTimeout(1100);
 assert.deepEqual(await state(),settled);assert.equal(settled.history[3].first,6);assert.equal(settled.history[3].second,6);assert.equal(settled.history[3].bps,1000);
 // CPU and tabletop share the compact banner at phone and desktop sizes.
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const size of [{width:320,height:568},{width:390,height:600},{width:390,height:844},{width:1280,height:900}])for(const solo of [false,true])for(const historyRounds of [0,1,11]){
  await page.setViewportSize(size);await seed({stage:'tryjpy',direction:'down',solo,historyRounds});await visible();
  await page.evaluate(()=>rollQueue=[5]);await page.locator('[data-action="draw-shock"]').click();await wait('movement-result');await visible();
  assert.equal(await page.locator('.market-history-candle').count(),historyRounds);assert.equal(await page.locator('.market-current-candle').count(),1);
  assert.equal(await page.locator('.market-round-label').count(),historyRounds+1);
  const svgBox=await page.locator('.market-history-chart').boundingBox();
  for(const label of await page.locator('.market-round-label').all()){const b=await label.boundingBox();assert(b.x>=svgBox.x&&b.x+b.width<=svgBox.x+svgBox.width)}
 }
 assert.deepEqual(errors,[]);console.log('PASS: static settled history with current candle joined to the previous close; monotonic actual up/down growth; normal dice have no animation; normal/gap rates; one draw and exact-once history; reload, reduced motion, route/reset/fast-forward; R01/R02/R12 tabletop/CPU at 320/390/1280px.');
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
