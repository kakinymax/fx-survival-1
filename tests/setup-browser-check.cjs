const {chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const [width,height]of [[320,568],[390,600],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.text().includes('not focusable'))errors.push(message.text())});
  const editor=mode=>page.locator(`[data-setup-names="${mode}"]`);
  const toggleNames=async(mode,open)=>{if(await editor(mode).evaluate(el=>el.open)!==open)await editor(mode).locator('summary').click()};
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fx-survival-v1')));
  const start=()=>page.locator('#setup-form button[type="submit"]').click();
  const reset=async()=>{await page.locator('[data-action="reset"]').click();await page.locator('#reset-confirm').click()};
  await page.goto('http://127.0.0.1:4173');
  assert.equal(await page.locator('.setup-intro h1').count(),0);
  assert.equal(await editor('tabletop').evaluate(el=>el.open),false);
  for(const count of [2,3,4,5,6]){
   await page.locator(`[data-count="${count}"]`).click();await start();
   const game=await state();assert.equal(game.phase,'order');assert.equal(game.players.length,count);assert.equal(game.players[0].name,'プレイヤーA');await reset();
  }
  // The native disclosure works with a keyboard and survives setup rerenders.
  await editor('tabletop').locator('summary').focus();await page.keyboard.press('Enter');
  assert.equal(await editor('tabletop').evaluate(el=>el.open),true);
  await page.locator('[data-name="0"]').fill('対人の名前');await page.locator('[data-name="5"]').fill('6人目の名前');
  await page.locator('[data-count="2"]').click();await page.locator('[data-count="6"]').click();await page.locator('[data-stage="tryjpy"]').click();
  assert.equal(await editor('tabletop').evaluate(el=>el.open),true);assert.equal(await page.locator('[data-name="5"]').inputValue(),'6人目の名前');
  await toggleNames('tabletop',false);await page.locator('[data-play="solo"]').click();
  assert.equal(await editor('solo').evaluate(el=>el.open),false);await toggleNames('solo',true);await page.locator('#solo-name').fill('CPU対戦の名前');await page.locator('[data-stage="usdjpy"]').click();
  assert.equal(await editor('solo').evaluate(el=>el.open),true);assert.equal(await page.locator('#solo-name').inputValue(),'CPU対戦の名前');
  await page.locator('[data-play="tabletop"]').click();assert.equal(await editor('tabletop').evaluate(el=>el.open),false);
  await toggleNames('tabletop',true);assert.equal(await page.locator('[data-name="0"]').inputValue(),'対人の名前');
  // Both native required validation and whitespace errors reveal the editor.
  await page.locator('[data-name="0"]').fill('');await toggleNames('tabletop',false);await start();
  assert.equal(await editor('tabletop').evaluate(el=>el.open),true);assert.equal(await page.locator('[data-name="0"]').evaluate(el=>document.activeElement===el),true);assert.equal(await page.locator('#setup-form').count(),1);
  await page.locator('[data-name="0"]').fill('   ');await toggleNames('tabletop',false);await start();
  assert.equal(await editor('tabletop').evaluate(el=>el.open),true);assert(await page.locator('#form-error').innerText());assert.equal(await page.locator('[data-name="0"]').evaluate(el=>document.activeElement===el),true);
  await page.locator('[data-name="0"]').fill('対人の名前');await toggleNames('tabletop',false);await page.locator('[data-mode="manual"]').click();await start();
  let game=await state();assert.equal(game.players.length,6);assert.equal(game.players[0].name,'対人の名前');assert.equal(game.players[5].name,'6人目の名前');assert.equal(game.mode,'manual');await reset();
  await page.locator('[data-play="solo"]').click();await toggleNames('solo',true);await page.locator('#solo-name').fill('');await toggleNames('solo',false);await start();
  assert.equal(await editor('solo').evaluate(el=>el.open),true);assert.equal(await page.locator('#solo-name').evaluate(el=>document.activeElement===el),true);
  await page.locator('#solo-name').fill('   ');await toggleNames('solo',false);await start();assert.equal(await editor('solo').evaluate(el=>el.open),true);assert(await page.locator('#form-error').innerText());
  await page.locator('#solo-name').fill('CPU対戦の名前');await toggleNames('solo',false);await start();
  game=await state();assert.equal(game.playMode,'solo');assert.equal(game.players[0].name,'CPU対戦の名前');assert.equal(game.players.filter(p=>p.cpu).length,3);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  console.log(`PASS ${width}×${height}: folded names, default starts for 2–6 players, keyboard toggle, retained fields/open states, hidden-field validation and configured tabletop/CPU starts`);
  await context.close();
 }
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
