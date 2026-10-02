const {chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const click=a=>page.locator(`[data-action="${a}"]`).click();
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fx-survival-v1')));
 const reset=async()=>{await page.evaluate(()=>localStorage.clear());await page.reload()};
 const start=async(id,mode='manual')=>{await page.locator(`[data-stage="${id}"]`).click();await page.locator('[data-count="2"]').click();await page.locator(`[data-mode="${mode}"]`).click();await page.locator('#setup-form button[type="submit"]').click()};
 const orders=async(lev)=>{for(let i=0;i<2;i++){await click('begin');await page.locator('[data-side="buy"]').click();await page.locator('#leverage').fill(String(lev));await page.locator('#order-submit').click()}await click('reveal-orders');await click('market-start')};
 const finish=async()=>{await click('start-decisions');for(let i=0;i<2;i++){await click('begin');await page.locator('[data-decision="fix"]').click();await click('commit-decision')}await click('reveal-decisions');await click('next-round')};
 await page.goto('http://127.0.0.1:4173');
 assert.equal(await page.locator('[data-stage]').count(),3);
 await page.locator('[data-stage="tryjpy"]').click();await page.locator('.stage-details summary').click();
 assert((await page.locator('.stage-details').innerText()).includes('20%'));
 await page.screenshot({path:'/workspace/fx-survival/stages-mobile.png',fullPage:true});
 for(const [id,name,rate,wealth]of [['classic','クラシック','0.5%','1250'],['usdjpy','ドル円','0.3%','1150'],['tryjpy','トルコリラ円','1%','1500']]){
  await reset();await start(id);assert.equal((await state()).stage,id);assert.equal(await page.locator('[data-stage]').count(),0);
  assert((await page.locator('[data-stage-active]').innerText()).includes(name));
  await page.reload();assert.equal((await state()).stage,id);
  await orders(50);await page.locator('[data-direction="up"]').click();assert((await page.locator('.tip').innerText()).includes('4：'+rate));await page.locator('[data-face="4"]').click();assert((await page.locator('.market-banner').innerText()).includes(rate));await click('settle');assert.deepEqual((await state()).players.map(p=>p.wealth),[wealth,wealth]);
  await page.locator('#rules-open').click();assert((await page.locator('#rules-market h3').innerText()).includes(name));assert((await page.locator('#rules-market').innerText()).includes('1/12'));await page.locator('#rules-close').click();
  await finish();assert.equal((await state()).phase,'end');assert((await page.locator('[data-stage-active]').innerText()).includes(name));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 for(const [id,bps,wealth]of [['usdjpy',150,'-500'],['tryjpy',500,'-4000']]){
  await reset();await start(id);await orders(100);await page.locator('[data-direction="down"]').click();await page.locator('[data-face="6"]').click();assert((await page.locator('.tip').innerText()).includes('4：'+bps/100+'%'));await page.locator('[data-face="4"]').click();assert((await page.locator('.market-banner').innerText()).includes('ギャップ'));await click('settle');await click('start-decisions');assert.equal((await state()).phase,'end');assert((await state()).players.every(p=>p.wealth===wealth&&p.status==='debt'));
 }
 await reset();await start('usdjpy','auto');await orders(1);assert.equal(await page.locator('[data-action="roll-direction"]').innerText(),'アプリで相場方向を抽選');await click('roll-direction');await click('roll-dice');if((await state()).phase==='shock')await click('roll-dice');await click('settle');const s=await state();assert.equal(s.history[0].stage,'usdjpy');assert.equal(s.phase,'results');
 await page.evaluate(()=>{const g=JSON.parse(localStorage.getItem('fx-survival-v1'));delete g.stage;g.phase='handoff-order';localStorage.setItem('fx-survival-v1',JSON.stringify(g))});await page.reload();assert.equal((await state()).stage,'classic');
 await reset();await page.setViewportSize({width:320,height:740});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'/workspace/fx-survival/stages-desktop.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: all stage choices, manual table and settlement, gap debt, auto mode, frozen selection, reload migration, rules, ending, 320px mobile; no page errors.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
