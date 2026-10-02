const {chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const click=a=>page.locator(`[data-action="${a}"]`).click();
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fx-survival-v1')));
 const screenshot=p=>page.screenshot({path:p,fullPage:true});
 await page.goto('http://127.0.0.1:4173');
 await page.locator('[data-count="3"]').click();await page.locator('[data-mode="manual"]').click();
 await screenshot('/workspace/fx-survival/setup-mobile.png');
 await page.locator('#setup-form button[type="submit"]').click();
 for(const [side,leverage]of [['buy',50],['sell',80],['buy',100]]){
  assert.equal((await state()).phase,'handoff-order');assert.equal(await page.locator('#leverage').count(),0);
  await click('begin');await page.locator('#leverage').fill('1.5');await page.locator(`[data-side="${side}"]`).click();assert.equal(await page.locator('#order-submit').isDisabled(),true);
  await page.locator('#leverage').fill(String(leverage));await page.locator('#order-submit').click();
 }
 assert.equal((await state()).phase,'ready-orders');assert.equal(await page.locator('.order-card').count(),0);
 await page.reload();assert.equal((await state()).phase,'ready-orders');
 await click('reveal-orders');assert.equal(await page.locator('.order-card').count(),3);assert((await page.locator('.order-card').first().innerText()).includes('5,000.0万円'));
 await click('market-start');await page.locator('[data-direction="up"]').click();await page.locator('[data-face="4"]').click();await click('settle');
 let s=await state();assert.deepEqual(s.players.map(p=>p.wealth),['1250','600','1500']);
 await screenshot('/workspace/fx-survival/results-mobile.png');
 await click('start-decisions');
 for(const choice of ['fix','continue','continue']){await click('begin');await page.locator(`[data-decision="${choice}"]`).click();await click('commit-decision')}
 s=await state();assert.equal(s.players[0].status,'active');await click('reveal-decisions');assert.equal((await state()).players[0].status,'fixed');await click('next-round');
 await click('begin');await page.locator('[data-side="buy"]').click();await page.locator('#leverage').fill('100');await page.reload();assert.equal((await state()).phase,'handoff-order');await click('begin');assert.equal(await page.locator('#leverage').inputValue(),'1');
 for(let i=0;i<2;i++){
  if(i)await click('begin');await page.locator('[data-side="buy"]').click();await page.locator('#leverage').fill('100');await page.locator('#order-submit').click();
 }
 await click('reveal-orders');await click('market-start');await page.locator('[data-direction="down"]').click();await page.locator('[data-face="6"]').click();assert.equal((await state()).phase,'shock');await page.locator('[data-face="5"]').click();assert((await page.locator('.market-banner').innerText()).includes('ギャップ'));await click('settle');await click('start-decisions');
 s=await state();assert.equal(s.phase,'end');assert.deepEqual(s.players.map(p=>p.wealth),['1250','-2400','-6000']);assert((await page.locator('.ending').innerText()).includes('プレイヤーA'));assert.equal(await page.locator('tbody tr').count(),3);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await screenshot('/workspace/fx-survival/ending-mobile.png');
 await page.setViewportSize({width:1280,height:900});await click('reset');await page.locator('#reset-confirm').click();await screenshot('/workspace/fx-survival/setup-desktop.png');
 await page.locator('[data-count="2"]').click();await page.locator('[data-mode="auto"]').click();await page.locator('#setup-form button[type="submit"]').click();
 for(let i=0;i<2;i++){await click('begin');await page.locator('[data-side="sell"]').click();await page.locator('#order-submit').click()}
 await click('reveal-orders');await click('market-start');await click('roll-direction');await click('roll-dice');if((await state()).phase==='shock')await click('roll-dice');await click('settle');assert.equal((await state()).phase,'results');
 await page.locator('#rules-open').click();assert.equal(await page.locator('#rules').isVisible(),true);await page.locator('#rules-close').click();
 assert.deepEqual(errors,[]);console.log('PASS: mobile secrecy, reload, manual dice, gap debt, early exit, ending, desktop, automatic dice, rules; zero page errors.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
