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
 const chart=()=>page.locator('canvas[data-trend-model]');
 const chartState=()=>chart().evaluate(canvas=>{
  const r=canvas.trendResult,active=r.bodies.find(b=>b.active);
  const model=JSON.parse(decodeURIComponent(canvas.dataset.trendModel));
  const slot=Math.round(r.plot.left+(r.plot.right-r.plot.left)/Math.max(4,Math.ceil(model.round/4)*4)*(model.round-.5));
  const limit=(active?.x??slot)-Math.ceil(r.barWidth/2)-2;
  let hash=2166136261;
  for(let y=r.plot.top;y<=r.plot.bottom+15;y++)for(let x=0;x<limit;x++)hash=Math.imul(hash^(r.raster.bits[y*r.raster.stride+(x>>3)]&(128>>(x&7))?1:0),16777619)>>>0;
  return {bodies:r.bodies,stats:r.stats,domain:[r.low,r.high],ticks:r.ticks,historyPixels:hash,moving:canvas.dataset.trendMoving==='true',elapsed:Number(canvas.dataset.trendElapsed),label:canvas.getAttribute('aria-label'),radius:getComputedStyle(canvas.parentElement).borderRadius};
 });

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
  await page.goto(origin);await page.waitForSelector('.market-draw');await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>document.querySelector('canvas[data-trend-model]')?.trendResult);
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
  await seed({stage:'tryjpy',direction});assert.equal((await chartState()).bodies.filter(b=>b.active).length,0);
  assert.equal((await chartState()).bodies.filter(b=>!b.active).length,3);
  const pending=await chartState(),oldGeometry=pending.bodies.filter(b=>!b.active);
  const before=await state();await page.evaluate(n=>rollQueue=[n-1],second);
  await page.locator('[data-action="draw-shock"]').click();
  assert.equal((await state()).second,second);assert.equal((await state()).phase,'drawing');
  assert.equal(await page.locator('[data-market-fact="second"]').count(),0);
  assert.equal(await page.locator('.market-banner.gap').count(),0);
  assert(!(await page.locator('.candle-summary').innerText()).includes('%'));await visible();
  assert.deepEqual((await chartState()).bodies.filter(b=>!b.active),oldGeometry);assert.equal((await chartState()).historyPixels,pending.historyPixels);
  const samples=[];
  for(const progress of [.15,.45,.75]){
   await page.waitForFunction(p=>{
    const body=document.querySelector('canvas[data-trend-model]')?.trendResult?.bodies.at(-1);
    return body&&Math.abs((body.displayClose-body.open)/(body.close-body.open))>=p;
   },progress);
   const drawing=await chartState();
   samples.push(drawing.bodies.at(-1));
   assert.equal(drawing.moving,true);assert.equal(drawing.stats.last,pending.stats.last);
   assert.equal(drawing.historyPixels,pending.historyPixels);assert.deepEqual(drawing.domain,pending.domain);
   assert(!drawing.label.includes('%'));
  }
  assert(Math.abs(samples[0].displayClose-samples[0].open)<Math.abs(samples[1].displayClose-samples[1].open));
  assert(Math.abs(samples[1].displayClose-samples[1].open)<Math.abs(samples[2].displayClose-samples[2].open));
  for(const frame of samples){
   assert.equal(frame.openY,samples[0].openY);
   assert(frame.displayClose>=Math.min(frame.open,frame.close)&&frame.displayClose<=Math.max(frame.open,frame.close));
   assert(direction==='up'?frame.closeY<=frame.openY:frame.closeY>=frame.openY);
  }
  await wait('movement-result');const drawn=await state();
  assert.equal((await chartState()).moving,false);assert.equal(await page.evaluate(()=>randomCalls),1);
  assert.equal(await page.locator('.market-banner .big').innerText(),(direction==='up'?'＋':'−')+(second===1?'2':'20')+'%');
  assert.equal(await page.locator('.market-banner p').innerText(),second===1?'通常相場':'ギャップ相場');await visible();
  assert.deepEqual(drawn.orders,before.orders);assert.deepEqual(drawn.players,before.players);assert.deepEqual(drawn.history,before.history);
  assert.deepEqual((await chartState()).bodies.filter(b=>!b.active),oldGeometry);assert.equal((await chartState()).historyPixels,pending.historyPixels);
  const final=await chartState(),last=final.bodies.at(-1);
  assert.equal(last.open,final.bodies.at(-2).close);assert.equal(last.displayClose,last.close);assert.equal(final.stats.last,last.close);
  assert.equal(final.radius,'8px');assert(final.ticks.every(t=>Number.isInteger(t.value)));
 }
 // Reload restores the saved outcome immediately, without replaying or rerolling it.
 await seed({direction:'down'});await page.evaluate(()=>rollQueue=[4]);await page.locator('[data-action="draw-shock"]').click();
 await page.reload();await wait('movement-result');assert.equal((await state()).second,5);
 assert.equal(await page.evaluate(()=>randomCalls),0);assert.equal((await chartState()).moving,false);
 assert.equal(await page.locator('.market-banner .big').innerText(),'−5%');
 await page.locator('[data-action="settle-market"]').click();let settled=await state();
 assert.equal(settled.history.length,4);assert.equal(settled.history.at(-1).bps,500);assert.equal(settled.history.at(-1).gap,true);
 assert.equal(await page.locator('.market-mini-chart .chart-candle').count(),4);
 await page.reload();assert.deepEqual(await state(),settled);
 // Reduced motion presents the same candle and result with no 1-second wait.
 await page.emulateMedia({reducedMotion:'reduce'});await seed();await page.evaluate(()=>rollQueue=[0]);
 const started=Date.now();await page.locator('[data-action="draw-shock"]').click();await wait('movement-result');assert(Date.now()-started<650);
 assert.equal((await chartState()).bodies.filter(b=>b.active).length,1);assert.equal((await chartState()).moving,false);assert.equal((await chartState()).bodies.at(-1).displayClose,(await chartState()).bodies.at(-1).close);
 // Ordinary first dice add a candle immediately on revelation, with no body animation.
 await page.emulateMedia({reducedMotion:'no-preference'});await seed({first:null});await page.evaluate(()=>rollQueue=[3]);
 await page.locator('[data-action="draw-movement"]').click();assert.equal((await chartState()).bodies.filter(b=>b.active).length,0);
 await wait('movement-result');assert.equal((await state()).first,4);assert.equal((await chartState()).bodies.filter(b=>b.active).length,1);
 assert.equal((await chartState()).moving,false);assert.equal((await chartState()).bodies.at(-1).displayClose,(await chartState()).bodies.at(-1).close);
 // Returning from another route resumes the elapsed animation, rather than starting a new one.
 await seed();await page.evaluate(()=>rollQueue=[5]);await page.locator('[data-action="draw-shock"]').click();
 await page.evaluate(()=>location.hash='stats');await page.waitForFunction(()=>document.body.dataset.phase==='statistics');
 await page.evaluate(()=>location.hash='');await page.waitForSelector('.market-history-chart');
 assert((await chartState()).elapsed>0);
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
 for(const size of [{width:320,height:568},{width:390,height:600},{width:390,height:844},{width:1280,height:900}])for(const solo of [false,true])for(const historyRounds of [0,1,4,6,8,11]){
  await page.setViewportSize(size);await seed({stage:'tryjpy',direction:'down',solo,historyRounds});await visible();
  await page.evaluate(()=>rollQueue=[5]);await page.locator('[data-action="draw-shock"]').click();await wait('movement-result');await visible();
  assert.equal((await chartState()).bodies.filter(b=>!b.active).length,historyRounds);assert.equal((await chartState()).bodies.filter(b=>b.active).length,1);
  const drawing=await chartState(),box=await chart().boundingBox();
  assert.equal(drawing.bodies.length,historyRounds+1);
  assert(drawing.bodies.every(b=>b.x>=0&&b.x<box.width));
  assert(drawing.ticks.every(t=>Number.isInteger(t.value)));
 }
 assert.deepEqual(errors,[]);console.log('PASS: static settled history with current candle joined to the previous close; monotonic actual up/down growth; normal dice have no animation; normal/gap rates; one draw and exact-once history; reload, reduced motion, route/reset/fast-forward; R01/R02/R05/R07/R09/R12 tabletop/CPU at 320/390/1280px.');
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
