const {chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core');
const assert=require('node:assert/strict');
const origin='http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:600},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const original=crypto.getRandomValues.bind(crypto);window.randomCalls=0;crypto.getRandomValues=buffer=>{randomCalls++;return original(buffer)}});
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fx-survival-v1')));
 async function seed(kind){
  await page.goto(origin+'/engine.js');
  await page.evaluate(async kind=>{
   const e=await import('./engine.js'),s=await import('./solo.js'),high=n=>n;
   const names=['プレイヤーA','プレイヤーB','プレイヤーC','プレイヤーD','プレイヤーE','プレイヤーF'];
   const solo=['solo','cpu-fixed','observer'].includes(kind);
   const g=solo?s.createSoloGame('あなた','classic',high):e.createGame(names.slice(0,kind==='six'?6:4),'manual',kind==='empty'?'usdjpy':'classic');
   if(kind==='large'){g.players[0].name='<b>長い名前の参加者ABC</b>';g.players[0].wealth=g.players[0].peak='9007199254740993123456789'}
   const rounds=kind==='empty'?3:1;
   for(let round=0;round<rounds;round++){
    if(solo)s.submitSoloOrder(g,{side:'buy',leverage:73});
    else for(let i=0;g.phase==='order';i++){
     const special=['cut','debt','empty'].includes(kind);
     e.submitOrder(g,{side:special?(i===0?(kind==='empty'?'buy':'sell'):(kind==='empty'?'sell':'buy')):(i%2?'sell':'buy'),leverage:special?(i===0?(kind==='empty'?[99,95,60][round]:100):1):[1,25,73,100,50,10][i]});
    }
    const special=['cut','debt','empty'].includes(kind);
    Object.assign(g,{direction:kind==='empty'?'down':'up',first:special?6:4,second:special?(kind==='debt'?5:kind==='empty'?3:1):null,phase:'market-ready'});
    (solo?s.resolveSoloRound:e.resolveRound)(g,high);
    if(round+1<rounds)e.commitDecisions(g,Object.fromEntries(e.activePlayers(g).map(p=>[p.id,'continue'])));
   }
   if(kind==='cpu-fixed'||kind==='observer'){
    g.cpuDecisions={1:kind==='cpu-fixed'?'fix':'continue',2:'continue',3:'continue'};
    s.commitSoloDecision(g,kind==='observer'?'fix':'continue',high);
    if(kind==='cpu-fixed')s.submitSoloOrder(g,{side:'buy',leverage:1});
    Object.assign(g,{direction:'down',first:4,second:null,phase:'market-ready'});s.resolveSoloRound(g,high);
   }
   localStorage.setItem('fx-survival-v1',JSON.stringify(g));
  },kind);
  await page.goto(origin);await page.waitForSelector('.settlement-view');await page.evaluate(()=>document.fonts.ready);
 }
 async function checkValues(){
  const g=await state(),h=g.history.at(-1),expected=await page.evaluate(async g=>{const {money}=await import('./engine.js');return g.history.at(-1).results.map(r=>({id:r.id,wealth:money(r.after),pnl:(BigInt(r.pnl)>0n?'＋':'')+money(r.pnl)}))},g);
  for(const r of expected){
   assert.equal(await page.locator(`[data-result-wealth="${r.id}"]`).innerText(),r.wealth);
   assert.equal((await page.locator(`[data-result-pnl="${r.id}"]`).innerText()).replace(/^今回\s*/,''),r.pnl);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.evaluate(()=>randomCalls),0,'viewing settlement must not reroll CPU decisions or market outcomes');
  assert.equal(h.round,g.round);
 }
 for(const size of [{width:320,height:568},{width:390,height:600},{width:390,height:844},{width:1280,height:900}]){
  await page.setViewportSize(size);
  for(const kind of ['four','six','solo']){
   await seed(kind);await checkValues();const before=await state();
   if(size.width<=760){
    const dock=await page.locator('.turn-actions').boundingBox();
    if(kind!=='six'){
     const last=await page.locator(kind==='solo'?'.solo-cpu-result':'.batch-result').last().boundingBox();
     assert(last.y+last.height<=dock.y,`${kind} ${size.width}×${size.height} results under action: ${JSON.stringify({last,dock})}`);
    }
    for(const button of await page.locator('.batch-choices button,.solo-decision-buttons button').all()){
     const box=await button.boundingBox();assert(box.width>=44&&box.height>=48);
    }
   }
   await page.reload();assert.deepEqual(await state(),before);await checkValues();
  }
 }
 await page.setViewportSize({width:390,height:600});await seed('four');
 const initial=await state(),commit=page.locator('[data-action="commit-decisions"]');assert(await commit.isDisabled());
 await page.locator('[data-player="0"][data-decision="fix"]').click();
 const draft=await state();assert.equal(draft.players[0].status,'active');assert.deepEqual(draft.history,initial.history);
 assert.deepEqual(draft.players,initial.players);assert.deepEqual(draft.decisions,{0:'fix'});assert(await commit.isDisabled());
 assert.equal(await page.evaluate(()=>scrollY),0);assert(await page.locator('[data-player="0"][data-decision="fix"]').evaluate(el=>document.activeElement===el));
 await page.reload();assert.equal(await page.locator('[data-player="0"][data-decision="fix"]').getAttribute('aria-pressed'),'true');
 await page.locator('[data-action="all-continue"]').click();assert.equal(await page.locator('[data-decision="continue"][aria-pressed="true"]').count(),4);
 await page.locator('[data-player="1"][data-decision="fix"]').click();assert(await commit.isEnabled());await commit.click();
 const next=await state();assert.equal(next.phase,'order');assert.equal(next.round,2);assert.equal(next.players[1].status,'fixed');
 assert.equal(next.players[1].wealth,initial.players[1].wealth);assert.deepEqual(next.history[0].decisions,{0:'continue',1:'fix',2:'continue',3:'continue'});
 assert.equal(await page.locator('#order-form').count(),1);
 // Six results retain a live scroll cue, and editing the last choice preserves earlier ones and focus.
 await seed('six');await page.locator('[data-player="0"][data-decision="fix"]').click();
 await page.waitForFunction(()=>document.querySelector('[data-result-scroll-hint]')?.textContent.includes('下にあと'));
 await page.locator('.batch-result').last().evaluate(el=>el.scrollIntoView({block:'center'}));
 await page.waitForFunction(()=>document.querySelector('[data-result-scroll-hint]')?.textContent==='');
 await page.locator('[data-player="5"][data-decision="continue"]').click();
 assert.equal(await page.locator('[data-player="0"][data-decision="fix"]').getAttribute('aria-pressed'),'true');
 assert(await page.locator('[data-player="5"][data-decision="continue"]').evaluate(el=>document.activeElement===el));
 // Each permanent exit remains distinct and cannot receive a continue/fix choice.
 for(const kind of ['cut','debt','empty']){
  await seed(kind);await checkValues();const g=await state();assert.equal(g.players[0].status,kind);
  assert.equal(await page.locator('[data-player="0"][data-decision]').count(),0);
  assert.equal(await page.locator(`[data-result-player="0"] .status`).innerText(),{cut:'ロスカット',debt:'負債・退場',empty:'資金枯渇'}[kind]);
  await page.locator('[data-action="all-continue"]').click();assert.deepEqual(Object.keys((await state()).decisions),['1','2','3']);
 }
 await seed('solo');const solo=await state();await checkValues();
 assert.equal(await page.locator('[data-player][data-decision]').count(),0);assert(!(await page.locator('.solo-results').innerText()).includes('を選択'));
 await page.locator('.settlement-details summary').click();assert.deepEqual(await state(),solo);
 await page.locator('[data-action="chart-open"]').click();await page.keyboard.press('Escape');assert.deepEqual(await state(),solo);
 assert.equal(await page.evaluate(()=>randomCalls),0);
 // A fixed CPU has no current-round PnL; its previous round's gain is never reused.
 await seed('cpu-fixed');await checkValues();const fixed=await state();assert.equal(fixed.players[1].status,'fixed');
 assert.equal(await page.locator('[data-result-pnl="1"]').count(),0);assert.equal(await page.locator('[data-result-wealth="1"]').count(),1);
 await seed('observer');await checkValues();assert.equal(await page.locator('[data-result-pnl="0"]').count(),0);
 assert.equal(await page.locator('[data-action="solo-continue"]').count(),0);assert.equal(await page.locator('[data-action="solo-fix"]').count(),0);
 assert.equal(await page.locator('[data-action="observe-next"]').count(),1);assert.equal(await page.locator('[data-action="fast-forward"]').count(),1);
 await page.setViewportSize({width:320,height:568});await seed('large');await checkValues();
 assert.equal(await page.locator('.batch-player>strong').first().innerText(),(await state()).players[0].name);assert.equal(await page.locator('.batch-player>strong b').count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: exact settlement wealth/PnL at 320/390/1280px; four-player and CPU rows above mobile dock; 44×48px choices; saved reversible decision drafts and one-step commit; cut/debt/rounded-zero labels; hidden CPU decisions; readonly details/chart; no stale PnL for fixed players; observation and escaped huge values.');
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
