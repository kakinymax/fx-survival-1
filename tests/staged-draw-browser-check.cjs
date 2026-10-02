const {chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:600}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.testRolls=0;window.testFaces=[0,5,4];const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=buffer=>{window.testRolls++;if(window.testFaces.length){buffer[0]=window.testFaces.shift();return buffer}return original(buffer)}});
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fx-survival-v1')));
 const click=name=>page.locator(`[data-action="${name}"]`).click();
 const wait=phase=>page.waitForFunction(p=>JSON.parse(localStorage.getItem('fx-survival-v1')).phase===p,phase);
 const orders=async()=>{for(const side of ['buy','sell']){await page.locator(`[data-side="${side}"]`).click();await page.locator('#leverage').fill('100');await page.locator('#order-submit').click()}};
 const visible=async()=>{const banner=await page.locator('.market-banner').boundingBox(),dock=await page.locator('.turn-actions').boundingBox();assert.equal(await page.evaluate(()=>scrollY),0);assert(banner.y>=0&&banner.y+banner.height<=dock.y);assert(dock.y+dock.height<=page.viewportSize().height);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)};
 await page.goto('http://127.0.0.1:4173');await page.locator('[data-count="2"]').click();await page.locator('#setup-form button[type="submit"]').click();await orders();
 assert.equal((await state()).phase,'orders-revealed');await click('draw-direction');let s=await state();assert.equal(s.direction,'up');assert.equal(s.first,null);assert.equal(s.second,null);assert.equal(s.history.length,0);
 // Reload while the direction animation is running: keep the drawn direction, draw no die.
 await page.reload();await wait('direction-result');assert.equal(await page.evaluate(()=>testRolls),0);assert.equal((await state()).first,null);await visible();await page.screenshot({path:'/workspace/fx-survival/market-direction-mobile.png'});
 await page.waitForTimeout(1500);assert.equal((await state()).phase,'direction-result');assert.equal((await state()).first,null);
 await page.evaluate(()=>{testFaces=[5,4]});await click('draw-movement');await wait('movement-result');s=await state();assert.equal(s.first,6);assert.equal(s.second,null);assert.equal(s.history.length,0);assert.deepEqual(s.players.map(p=>p.wealth),['1000','1000']);assert.equal(await page.locator('[data-action="settle-market"]').count(),0);await visible();await page.screenshot({path:'/workspace/fx-survival/market-shock-mobile.png'});
 await page.waitForTimeout(1500);assert.equal((await state()).second,null);assert.equal((await state()).phase,'movement-result');
 await click('draw-shock');assert.equal((await state()).second,5);await page.reload();await wait('movement-result');s=await state();assert.equal(s.second,5);assert.equal(await page.evaluate(()=>testRolls),0);assert.deepEqual(s.players.map(p=>p.wealth),['1000','1000']);assert.equal(s.history.length,0);assert((await page.locator('.market-banner').innerText()).includes('5%'));assert((await page.locator('.market-banner').innerText()).includes('ギャップ'));
 await page.setViewportSize({width:320,height:568});await visible();await page.screenshot({path:'/workspace/fx-survival/market-movement-mobile.png'});assert.equal(await page.locator('[data-action^="draw-"]').count(),0);
 await page.waitForTimeout(1500);assert.equal((await state()).history.length,0);await click('settle-market');s=await state();assert.equal(s.phase,'results');assert.deepEqual(s.players.map(p=>p.wealth),['6000','-4000']);assert.equal(s.history.length,1);await page.reload();assert.equal((await state()).history.length,1);
 await page.locator('[data-player="0"][data-decision="fix"]').click();await click('commit-decisions');assert.equal((await state()).phase,'end');
 // Ordinary movement skips the second die and still waits for the settlement button.
 await click('reset');await page.locator('#reset-confirm').click();await page.locator('[data-count="2"]').click();await page.locator('[data-stage="usdjpy"]').click();await page.locator('#setup-form button[type="submit"]').click();await orders();await page.evaluate(()=>{testFaces=[1,3]});await page.emulateMedia({reducedMotion:'reduce'});
 await click('draw-direction');await wait('direction-result');assert.equal((await state()).direction,'down');await click('draw-movement');await wait('movement-result');s=await state();assert.equal(s.first,4);assert.equal(s.second,null);assert.equal(s.history.length,0);assert.equal(await page.locator('[data-action="draw-shock"]').count(),0);assert((await page.locator('.market-banner').innerText()).includes('0.3%'));await click('settle-market');assert.deepEqual((await state()).players.map(p=>p.wealth),['700','1300']);
 // Reset during an animation does not bring the previous game back.
 await click('all-continue');await click('commit-decisions');await orders();await page.emulateMedia({reducedMotion:'no-preference'});await click('draw-direction');await click('reset');await page.locator('#reset-confirm').click();await page.waitForTimeout(700);assert.equal(await page.locator('#setup-form').count(),1);assert.equal(await state(),null);
 assert.deepEqual(errors,[]);console.log('PASS: separate direction, die and shock buttons; result pages stay put; reload does not reroll or settle; normal branch; explicit exact-once settlement; 320px fixed actions; reset during draw.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
