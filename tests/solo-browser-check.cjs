const {chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:600}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.testFaces=[];window.testRolls=0;const original=crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues=buffer=>{testRolls++;if(testFaces.length){buffer[0]=testFaces.shift();return buffer}return original(buffer)};
  window.agentTools={};Object.defineProperty(document,'modelContext',{value:{registerTool(t){agentTools[t.name]=t},unregisterTool(){}}});
 });
 await page.emulateMedia({reducedMotion:'reduce'});
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fx-survival-v1')));
 const click=name=>page.locator(`[data-action="${name}"]`).click();
 const wait=phase=>page.waitForFunction(p=>JSON.parse(localStorage.getItem('fx-survival-v1')).phase===p,phase);
 const faces=xs=>page.evaluate(xs=>{testFaces=xs},xs);
 const visible=async locator=>{const box=await locator.boundingBox(),dock=await page.locator('.turn-actions').boundingBox();assert(box.y>=0&&box.y+box.height<=dock.y,`control under dock: ${JSON.stringify({box,dock})}`);assert(dock.y+dock.height<=page.viewportSize().height);assert.equal(await page.evaluate(()=>scrollY),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)};
 async function seed({leverage=1,direction=1,first=1,second=null,fixCpu=false}={}){
  await page.goto('http://127.0.0.1:4173/engine.js');
  await page.evaluate(async({leverage,direction,first,second,fixCpu})=>{
   const {createSoloGame,submitSoloOrder,resolveSoloRound}=await import('./solo.js');
   const {prepareAutoDraw,finishAutoDraw}=await import('./engine.js');
   const high=n=>n,g=createSoloGame('あなた','classic',high);
   submitSoloOrder(g,{side:'buy',leverage});
   prepareAutoDraw(g,'direction',()=>direction);finishAutoDraw(g);
   prepareAutoDraw(g,'first',()=>first);finishAutoDraw(g);
   if(first===6){prepareAutoDraw(g,'second',()=>second);finishAutoDraw(g)}
   resolveSoloRound(g,high);if(fixCpu)g.cpuDecisions={1:'fix',2:'fix',3:'fix'};
   localStorage.setItem('fx-survival-v1',JSON.stringify(g));
  },{leverage,direction,first,second,fixCpu});
  await page.goto('http://127.0.0.1:4173');
 }
 await page.goto('http://127.0.0.1:4173');await page.locator('[data-play="solo"]').click();assert.equal(await page.locator('[data-count]').count(),0);assert.equal(await page.locator('[data-mode]').count(),0);assert.equal(await page.locator('.cpu-profile').count(),3);await page.locator('[data-setup-names="solo"] summary').click();await page.locator('#solo-name').fill('テスト');await page.locator('[data-stage="tryjpy"]').click();await faces([0,0,0,0,0,0]);await page.locator('#setup-form button[type="submit"]').click();
 let s=await state();assert.equal(s.playMode,'solo');assert.equal(s.stage,'tryjpy');assert.equal(s.phase,'order');assert.equal(s.players[0].name,'テスト');assert.equal(await page.locator('.order-card').count(),0);assert.equal(await page.locator('[data-player]').count(),0);assert.equal(await page.locator('#app').innerText().then(t=>t.includes('堅実派 買い')),false);assert.equal(Object.keys(s.orders).length,3);assert.equal(await page.evaluate(()=>testRolls),6);await visible(page.locator('#position-value'));await page.screenshot({path:'/workspace/fx-survival/solo-order-mobile.png'});
 const locked=structuredClone(s.orders);await page.locator('[data-side="sell"]').click();await page.locator('#leverage').fill('73');await page.reload();assert.deepEqual((await state()).orders,locked);assert.equal(await page.evaluate(()=>testRolls),0);assert.equal(await page.locator('#order-submit').isDisabled(),true);
 const publicState=await page.evaluate(()=>agentTools.read_public_game_state.execute({}));assert.equal(publicState.playMode,'solo');assert.equal(publicState.orders,undefined);assert.equal(publicState.cpuDecisions,undefined);assert.equal(publicState.players.some(p=>p.side||p.leverage||p.decision),false);
 await page.setViewportSize({width:320,height:568});await visible(page.locator('#position-value'));await page.locator('[data-side="buy"]').click();await page.locator('#leverage').fill('100');await page.locator('#order-submit').click();await wait('orders-revealed');assert.equal(await page.locator('.order-card').count(),4);assert((await page.locator('.order-card').nth(1).innerText()).includes('買い'));assert((await page.locator('.order-card').nth(1).innerText()).includes('1倍'));
 await faces([0,0,99,99,99]);await click('draw-direction');await wait('direction-result');assert.equal((await state()).first,null);await click('draw-movement');await wait('movement-result');assert.equal((await state()).history.length,0);await click('settle-market');await wait('results');s=await state();assert.equal(s.players[0].wealth,'1200');assert.equal(s.history.length,1);assert.equal(Object.keys(s.cpuDecisions).length,3);assert.equal(await page.locator('[data-player]').count(),0);assert.equal(await page.locator('[data-action="all-continue"]').count(),0);assert.equal(await page.locator('.solo-cpu-result').count(),3);assert((await page.locator('.solo-results').innerText()).includes('少しずつでいい'));assert(!(await page.locator('.solo-results').innerText()).includes('資産確定を選択'));
 await page.setViewportSize({width:390,height:600});await visible(page.locator('.solo-results'));await page.screenshot({path:'/workspace/fx-survival/solo-results-mobile.png'});const decisions=structuredClone(s.cpuDecisions);await page.reload();assert.deepEqual((await state()).cpuDecisions,decisions);assert.equal(await page.evaluate(()=>testRolls),0);await click('solo-continue');s=await state();assert.equal(s.round,2);assert.equal(s.phase,'order');assert.equal(s.players[0].status,'active');for(const id of ['1','2','3'])assert.equal(s.history[0].decisions[id],decisions[id]);assert.equal(await page.locator('#order-submit').isDisabled(),true);
 // Lock wealth, observe a round with the original market buttons, then fast-forward a drawn direction.
 await seed();await click('solo-fix');s=await state();const fixed=s.players[0].wealth;assert.equal(s.players[0].status,'fixed');assert.equal(s.phase,'orders-revealed');assert.equal(await page.locator('#order-form').count(),0);assert.equal(await page.locator('[data-action="fast-forward"]').count(),1);await faces([1,0,99,99,99]);await click('draw-direction');await wait('direction-result');await click('draw-movement');await wait('movement-result');await click('settle-market');await wait('results');assert.equal(await page.locator('[data-action="solo-continue"]').count(),0);assert.equal(await page.locator('[data-action="solo-fix"]').count(),0);assert.equal(await page.locator('[data-action="observe-next"]').count(),1);assert.equal((await state()).players[0].wealth,fixed);await page.screenshot({path:'/workspace/fx-survival/solo-observe-mobile.png'});await click('observe-next');await faces([0]);await click('draw-direction');await wait('direction-result');await click('fast-forward');await wait('end');s=await state();assert.equal(s.players[0].wealth,fixed);assert.equal(s.history[2].direction,'up');assert.equal(s.history.length,s.round);assert(s.round<=12);assert.equal(new Set(s.history.map(h=>h.round)).size,s.history.length);assert((await page.locator('.ending').innerText()).includes('勝利'));assert((await page.locator('.end-surface table').innerText()).includes('最高から'));await page.screenshot({path:'/workspace/fx-survival/solo-ending-mobile.png'});await page.reload();assert.equal((await state()).phase,'end');
 // Forced retirement gives observation without allowing reentry; all CPU exits finish immediately.
 await seed({leverage:100,direction:2,first:6,second:5});assert.equal((await state()).players[0].status,'debt');assert.equal(await page.locator('[data-action="solo-continue"]').count(),0);await click('fast-forward');assert.equal((await state()).phase,'end');assert.equal((await state()).players[0].wealth,'-4000');
 await seed({fixCpu:true});await click('solo-fix');assert.equal((await state()).phase,'end');assert.equal((await state()).round,1);assert((await page.locator('.last-settlement').innerText()).includes('ここで降りる'));
 // Reset returns to mode selection, and ordinary tabletop play still uses private turns.
 await click('reset');await page.locator('#reset-confirm').click();await page.locator('[data-play="tabletop"]').click();await page.locator('[data-count="2"]').click();await page.locator('#setup-form button[type="submit"]').click();await page.locator('[data-side="buy"]').click();await page.locator('#order-submit').click();assert.equal((await state()).phase,'order');assert.equal((await state()).cursor,1);assert.equal((await state()).playMode,undefined);assert.equal(await page.locator('[data-action="fast-forward"]').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: solo setup and CPU roster; no secret CPU choices in UI/WebMCP; stored decisions and one-click progress; 320px order/390px results; staged observation; partial-draw fast-forward; debt and early endings; tabletop preserved.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
