const {chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core');
const assert=require('node:assert/strict');
const origin='http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:600},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const original=crypto.getRandomValues.bind(crypto);window.randomCalls=0;
  crypto.getRandomValues=buffer=>{randomCalls++;return original(buffer)};
 });
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fx-survival-v1')));
 async function seed(kind,large=false){
  await page.goto(origin+'/engine.js');
  await page.evaluate(async({kind,large})=>{
   const e=await import('./engine.js'),s=await import('./solo.js');
   const names=['プレイヤーA','プレイヤーB','プレイヤーC','プレイヤーD','プレイヤーE','プレイヤーF'];
   const g=kind==='solo'?s.createSoloGame('あなた','classic',n=>n):e.createGame(names.slice(0,kind==='six'?6:4),kind==='manual'?'manual':'auto');
   if(large){g.players[0].name='<b>長い名前のプレイヤーABC</b>';g.players[0].wealth=g.players[0].peak='9007199254740993123456789'}
   if(kind==='solo')s.submitSoloOrder(g,{side:'buy',leverage:73});
   else for(let i=0;g.phase==='order';i++)e.submitOrder(g,{side:i%2?'sell':'buy',leverage:[1,25,73,100,50,10][i]});
   localStorage.setItem('fx-survival-v1',JSON.stringify(g));
  },{kind,large});
  await page.goto(origin);await page.waitForSelector('.orders-list');await page.evaluate(()=>document.fonts.ready);
 }
 for(const size of [{width:320,height:568},{width:390,height:600},{width:390,height:844},{width:1280,height:900}]){
  await page.setViewportSize(size);
  for(const kind of ['four','six','solo','manual']){
   await seed(kind);
   const before=await state(),rolls=await page.evaluate(()=>randomCalls),active=before.players.filter(p=>p.status==='active');
   assert.equal(await page.getByRole('list',{name:'公開された注文'}).count(),1);
   assert.equal(await page.locator('.order-card').count(),active.length);
   const amounts=await page.evaluate(async g=>{const {money}=await import('./engine.js');return g.players.filter(p=>p.status==='active').map(p=>money(BigInt(p.wealth)*BigInt(g.orders[p.id].leverage)))},before);
   for(const [i,p] of active.entries()){
    const row=page.locator(`[data-order-player="${p.id}"]`),o=before.orders[p.id];
    assert((await row.locator('.order-name').innerText()).includes(p.name));
    assert.equal(await row.locator('.order-side').innerText(),o.side==='buy'?'買い':'売り');
    assert.equal(await row.locator('.order-leverage').innerText(),o.leverage+'倍');
    assert.equal(await row.locator('.order-amount strong').innerText(),amounts[i]);
   }
   if(size.width<=760){
    const dock=await page.locator('.turn-actions').boundingBox();
    assert.equal(await page.evaluate(()=>scrollY),0);assert(dock.y+dock.height<=size.height+1);
    if(kind!=='six'||size.width>=390){
     const last=await page.locator('.order-card').last().boundingBox();
     assert(last.y+last.height<=dock.y,`${kind} ${size.width}×${size.height} orders covered by action: ${JSON.stringify({last,dock})}`);
    }
    for(const button of await page.locator('.turn-actions button').all()){
     const box=await button.boundingBox();assert(box.y>=dock.y&&box.y+box.height<=size.height+1);assert(box.height>=48);
    }
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.reload();assert.deepEqual(await state(),before);assert.equal(await page.evaluate(()=>randomCalls),0);
   assert.equal(before.direction,null);assert.equal(before.first,null);assert.equal(before.second,null);assert.equal(before.history.length,0);
   assert.equal(rolls,0,'viewing revealed orders must not draw a market outcome');
  }
 }
 // Full names and exact very large trade values stay readable without horizontal clipping.
 await page.setViewportSize({width:320,height:568});await seed('six',true);
 const saved=await state();assert.equal(await page.locator('.order-name b').count(),0);
 assert.equal(await page.locator('.order-name').first().innerText(),saved.players[0].name);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.evaluate(()=>document.documentElement.style.fontSize='');
 // The same two manual controls commit the direction once, with no extra screen or die.
 await seed('manual');const beforeManual=await state();
 await page.locator('[data-direction="down"]').focus();await page.keyboard.press('Enter');
 const manual=await state();assert.equal(manual.phase,'dice');assert.equal(manual.direction,'down');assert.equal(manual.first,null);
 assert.deepEqual(manual.orders,beforeManual.orders);assert.equal(await page.evaluate(()=>randomCalls),0);
 // The existing automatic button consumes one direction roll and keeps every saved order.
 await seed('four');const beforeAuto=await state();await page.locator('[data-action="draw-direction"]').click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('fx-survival-v1')).phase==='direction-result');
 const auto=await state();assert(['up','down'].includes(auto.direction));assert.equal(auto.first,null);assert.equal(auto.second,null);
 assert.deepEqual(auto.orders,beforeAuto.orders);assert.equal(auto.history.length,0);assert.equal(await page.evaluate(()=>randomCalls),1);
 assert.deepEqual(errors,[]);
 console.log('PASS: aligned exact revealed orders across tabletop/CPU/manual at 320/390/1280px; four mobile orders and six at 390px visible above dock; large escaped names/amounts and text zoom without overflow; reload without draws; same one-step manual/automatic direction controls.');
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
