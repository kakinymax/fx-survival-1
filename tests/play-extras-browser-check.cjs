const {chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core');
const assert=require('node:assert/strict');
const origin='http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:600},reducedMotion:'reduce',extraHTTPHeaders:{'oai-authenticated-user-id':`play-extras-${Date.now()}`}});
 const page=await context.newPage(),errors=[],writes=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.method()==='PUT'&&r.url().includes('/api/matches/'))writes.push(JSON.parse(r.postData()))});
 await page.addInitScript(()=>{
  const original=crypto.getRandomValues.bind(crypto);window.randomCalls=0;window.forceLowest=false;
  crypto.getRandomValues=buffer=>{randomCalls++;if(forceLowest){buffer.fill(0);return buffer}return original(buffer)};
 });
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fx-survival-v1')));
 async function seed(kind){
  await page.goto(origin+'/engine.js');
  await page.evaluate(async kind=>{
   const e=await import('./engine.js'),s=await import('./solo.js'),r=await import('./records.js'),high=n=>n;
   let g;
   function draw(direction,first,second){e.prepareAutoDraw(g,'direction',()=>direction);e.finishAutoDraw(g);e.prepareAutoDraw(g,'first',()=>first);e.finishAutoDraw(g);if(first===6){e.prepareAutoDraw(g,'second',()=>second);e.finishAutoDraw(g)}}
   if(['solo-order','spectator','solo-loss','solo-gap','solo-zero','solo-huge'].includes(kind)){
    g=s.createSoloGame('<b>自分</b>',['solo-order','spectator'].includes(kind)?'tryjpy':'classic',high);
    if(kind==='solo-zero')g.players[0].wealth='1';
    if(kind==='solo-huge')g.players[0].wealth=g.players[0].peak='9007199254740993123456789';
    s.submitSoloOrder(g,{side:kind==='solo-gap'?'sell':'buy',leverage:kind==='solo-order'?73:1});
    if(kind==='solo-loss')draw(2,5);else if(kind==='solo-gap')draw(1,6,4);else draw(1,1);
    s.resolveSoloRound(g,high);s.commitSoloDecision(g,kind==='spectator'?'fix':'continue',high);
    if(kind==='spectator')draw(1,6,5);
   }else if(kind==='table-order'){
    g=e.createGame(['確定した人','一人目','二人目'],'manual','classic');
    e.submitOrder(g,{side:'buy',leverage:5});e.submitOrder(g,{side:'sell',leverage:7});e.submitOrder(g,{side:'buy',leverage:2});
    Object.assign(g,{direction:'up',first:4,phase:'market-ready'});e.resolveRound(g);e.commitDecisions(g,{0:'fix',1:'continue',2:'continue'});
   }else{
    g=e.createGame(kind==='six'?['A','B','C','D','E','F']:['一人目','二人目'],'manual','usdjpy');
    while(g.phase==='order')e.submitOrder(g,{side:'buy',leverage:50});g.direction='up';g.first=4;g.phase='market-ready';e.resolveRound(g);
    if(kind==='complete')e.commitDecisions(g,{0:'fix',1:'fix'});
   }
   r.ensureGameIdentity(g,{newGame:true});localStorage.setItem('fx-survival-v1',JSON.stringify(g));
  },kind);
  await page.goto(origin);await page.waitForSelector('#app section');
 }
 async function orderVisible(){
  const dock=await page.locator('.turn-actions').boundingBox();
  assert.equal(await page.evaluate(()=>scrollY),0);
  for(const selector of ['[data-side="buy"]','[data-side="sell"]','#leverage','#leverage-range','.previous-result','.position']){
   const box=await page.locator(selector).boundingBox();assert(box.y>=0&&box.y+box.height<=dock.y,`${selector} covered: ${JSON.stringify({box,dock})}`);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await seed('solo-order');const original=await state(),locked=structuredClone(original.orders);
 assert.equal(await page.locator('#leverage').inputValue(),'1');assert.equal(await page.locator('[data-side][aria-pressed="true"]').count(),0);
 assert.equal(await page.locator('[data-action="previous-leverage"]').innerText(),'前回 73倍');await orderVisible();
 assert.equal(await page.locator('.previous-result').getAttribute('data-previous-player'),'0');
 assert.equal(await page.locator('.previous-market strong').innerText(),'上昇 ＋0.2%');
 assert.equal(await page.locator('.previous-trade .buy').innerText(),'買い');
 assert.equal(await page.locator('.previous-pnl').innerText(),'＋14.6万円');
 await page.setViewportSize({width:320,height:568});await orderVisible();
 await page.locator('[data-action="previous-leverage"]').click();assert.equal(await page.locator('#leverage').inputValue(),'73');assert(await page.locator('#order-submit').isDisabled());assert.deepEqual((await state()).orders,locked);
 const beforeRandom=await page.evaluate(()=>randomCalls);
 await page.locator('#impact-open').click();assert(await page.locator('#impact-dialog').isVisible());assert.equal(await page.locator('#impact-content tbody tr').count(),10);
 assert((await page.locator('#impact-content').innerText()).includes('負債・退場'));assert((await page.locator('#impact-content').innerText()).includes('ロスカット'));
 assert((await page.locator('#impact-description').innerText()).includes('的中／逆行'));assert((await page.locator('#impact-content').innerText()).includes('予想ではありません'));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'/workspace/fx-survival/extras-impact-small.png'});
 await page.keyboard.press('Escape');assert.equal(await page.locator('#impact-dialog').isVisible(),false);assert.equal(await page.locator('#impact-open').evaluate(el=>document.activeElement===el),true);
 assert.equal(await page.evaluate(()=>randomCalls),beforeRandom);assert.deepEqual(await state(),original);
 await page.locator('#leverage').fill('0');assert(await page.locator('#impact-open').isDisabled());assert(await page.locator('#order-submit').isDisabled());await page.locator('#leverage').fill('1');await page.locator('[data-side="sell"]').click();await page.locator('[data-action="previous-leverage"]').click();assert.equal(await page.locator('[data-side="sell"]').getAttribute('aria-pressed'),'true');
 await page.locator('#leverage').blur();await page.screenshot({path:'/workspace/fx-survival/extras-solo-order-small.png'});await page.reload();await orderVisible();assert.equal(await page.locator('#leverage').inputValue(),'1');assert.equal(await page.locator('[data-action="previous-leverage"]').innerText(),'前回 73倍');assert.deepEqual((await state()).orders,locked);
 await page.setViewportSize({width:390,height:600});await orderVisible();await page.screenshot({path:'/workspace/fx-survival/extras-solo-order-mobile.png'});
 // The actual settled loss, zero rounding and gap are facts, not a new estimate.
 for(const size of [{width:320,height:568},{width:390,height:600},{width:390,height:844},{width:1280,height:900}]){
  await page.setViewportSize(size);
  for(const kind of ['solo-loss','solo-gap','solo-zero']){
   await seed(kind);const before=await state(),rolls=await page.evaluate(()=>randomCalls);
   assert.equal(await page.locator('.previous-market strong').innerText(),kind==='solo-loss'?'下落 −0.8%':kind==='solo-gap'?'上昇 ＋2%':'上昇 ＋0.1%');
   assert.equal(await page.locator('.previous-market small').innerText(),kind==='solo-gap'?'ギャップ':'通常');
   assert.equal(await page.locator('.previous-trade>span').first().innerText(),kind==='solo-gap'?'売り':'買い');
   assert.equal(await page.locator('.previous-pnl').innerText(),kind==='solo-loss'?'−0.8万円':kind==='solo-gap'?'−2.0万円':'0.0万円');
   assert.equal(await page.locator('.previous-pnl').evaluate(el=>el.classList.contains('negative')),kind!=='solo-zero');
   await orderVisible();await page.reload();await orderVisible();assert.deepEqual(await state(),before);assert.equal(await page.evaluate(()=>randomCalls),0);assert.equal(rolls,0);
   if(kind==='solo-loss')await page.screenshot({path:`/workspace/scratch/previous-result-order-${size.width}x${size.height}.png`});
  }
 }
 await page.setViewportSize({width:320,height:568});await seed('solo-huge');
 const huge=await state(),exact=await page.evaluate(async pnl=>{const {money}=await import('./engine.js');return '＋'+money(pnl)},huge.history[0].results.find(r=>r.id===0).pnl);
 assert.equal(await page.locator('.previous-pnl').innerText(),exact);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 // A fixed player changes the cursor index; the result still belongs to the ID.
 await page.setViewportSize({width:390,height:600});await seed('table-order');await orderVisible();
 assert.equal(await page.locator('.previous-result').getAttribute('data-previous-player'),'1');assert.equal(await page.locator('.previous-leverage').innerText(),'前回 7倍');assert.equal(await page.locator('.previous-pnl').innerText(),'−3.5万円');
 assert.equal(await page.locator('[data-action="previous-leverage"]').count(),0);
 await page.locator('[data-side="buy"]').click();await page.locator('#order-submit').click();await orderVisible();
 assert.equal(await page.locator('.previous-result').getAttribute('data-previous-player'),'2');assert.equal(await page.locator('.previous-leverage').innerText(),'前回 2倍');assert.equal(await page.locator('.previous-pnl').innerText(),'＋1.0万円');
 assert.equal(await page.locator('[data-side][aria-pressed="true"]').count(),0);assert.equal(await page.locator('#leverage').inputValue(),'1');
 // Six rows have a live cue; recording a visible choice does not move the screen.
 await seed('six');assert.equal(await page.locator('[data-action="previous-leverage"]').count(),0);assert.equal(await page.locator('.previous-result').count(),0);
 await page.waitForFunction(()=>document.querySelector('[data-result-scroll-hint]')?.textContent.includes('下にあと'));
 await page.locator('[data-player="0"][data-decision="fix"]').click();assert.equal(await page.evaluate(()=>scrollY),0);assert.equal(await page.locator('[data-player="0"][data-decision="fix"]').getAttribute('aria-pressed'),'true');
 await page.screenshot({path:'/workspace/fx-survival/extras-six-results-mobile.png'});
 await page.locator('.batch-result').last().evaluate(el=>el.scrollIntoView({block:'center'}));await page.waitForFunction(()=>document.querySelector('[data-result-scroll-hint]')?.textContent==='');
 await page.locator('[data-player="5"][data-decision="continue"]').click();assert.equal(await page.locator('[data-player="0"][data-decision="fix"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-player="5"][data-decision="continue"]').evaluate(el=>document.activeElement===el),true);
 await page.setViewportSize({width:320,height:568});await page.evaluate(()=>scrollTo(0,0));await page.waitForFunction(()=>document.querySelector('[data-result-scroll-hint]')?.textContent.includes('下にあと'));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');await page.locator('.batch-result').last().evaluate(el=>el.scrollIntoView({block:'center'}));await page.waitForFunction(()=>document.querySelector('[data-result-scroll-hint]')?.textContent==='');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.evaluate(()=>document.documentElement.style.fontSize='');
 // Fast-forward keeps the drawn gap and generates <=3 facts from the canonical log.
 await seed('spectator');const partial=await state();assert.equal(partial.first,6);assert.equal(partial.second,5);await page.evaluate(()=>forceLowest=true);await page.locator('[data-action="fast-forward"]').click();await page.waitForFunction(()=>document.querySelector('[data-record-status]')?.textContent.includes('保存しました'));
 const ended=await state(),record=ended.finalRecord;assert.equal(ended.fastForwardFromRound,2);assert.equal(record.history[1].direction,'up');assert.equal(record.history[1].second,5);assert.equal(record.history.filter(h=>h.round===2).length,1);assert.equal(record.players[0].wealth,partial.players[0].wealth);
 const facts=await page.evaluate(async r=>(await import('./play-extras.js')).fastForwardHighlights(r,2),record);assert(facts.length>0&&facts.length<=3);assert.equal(await page.locator('[data-highlight]').count(),facts.length);assert.equal(await page.locator('.fast-forward-digest b').count(),0);assert((await page.locator('.fast-forward-digest').innerText()).includes('負債・退場'));
 await page.setViewportSize({width:390,height:600});await page.screenshot({path:'/workspace/fx-survival/extras-fast-forward-mobile.png',fullPage:true});await page.reload();assert.equal(await page.locator('[data-highlight]').count(),facts.length);assert.deepEqual((await state()).finalRecord,record);
 // Replay must use the final snapshot, even if stale live settings differ.
 await page.goto(origin+'/engine.js');await page.evaluate(()=>{const g=JSON.parse(localStorage.getItem('fx-survival-v1'));g.stage='classic';g.players[0].name='古い表示';localStorage.setItem('fx-survival-v1',JSON.stringify(g))});await page.goto(origin);await page.locator('[data-action="replay"]').click();const replay=await state();assert.notEqual(replay.gameId,record.id);assert.equal(replay.stage,'tryjpy');assert.equal(replay.players[0].name,'<b>自分</b>');assert(replay.players.every(p=>p.wealth==='1000'&&p.peak==='1000'&&p.maxPosition==='0'));assert.equal(replay.round,1);assert.deepEqual(replay.history,[]);assert.equal(replay.finalRecord,undefined);assert.equal(await page.locator('[data-action="previous-leverage"]').count(),0);assert.equal(await page.locator('#leverage').inputValue(),'1');assert.equal(await page.locator('[data-side][aria-pressed="true"]').count(),0);assert.equal(await page.locator('#reset-dialog').isVisible(),false);
 assert.equal(await page.evaluate(async id=>(await fetch('/api/matches/'+id)).status,record.id),200);
 // An unsaved result remains in the retry outbox across direct manual replay.
 await page.route('**/api/matches/*',route=>route.request().method()==='PUT'?route.fulfill({status:503,contentType:'application/json',body:'{"error":"unavailable"}'}):route.continue());await seed('complete');await page.waitForSelector('[data-action="retry-record"]');const failed=(await state()).finalRecord;await page.locator('[data-action="replay"]').click();const next=await state();assert.equal(next.mode,'manual');assert.equal(next.stage,'usdjpy');assert.deepEqual(next.players.map(p=>p.name),failed.players.map(p=>p.name));assert.notEqual(next.gameId,failed.id);assert.equal(next.phase,'order');assert.equal(next.finalRecord,undefined);assert.equal(await page.locator('.fast-forward-digest').count(),0);
 assert(await page.evaluate(id=>JSON.parse(localStorage.getItem('fx-survival-pending-records-v1')).records.some(r=>r.id===id),failed.id));
 await page.unroute('**/api/matches/*');await page.evaluate(()=>dispatchEvent(new Event('online')));await page.waitForFunction(()=>JSON.parse(localStorage.getItem('fx-survival-pending-records-v1')??'{"records":[]}').records.length===0);
 const stored=await page.evaluate(async id=>{const res=await fetch('/api/matches/'+id);return res.json()},failed.id);assert.deepEqual(stored.record??stored,failed);assert(writes.filter(r=>r.id===failed.id).every(r=>JSON.stringify(r)===JSON.stringify(failed)));assert.equal((await state()).gameId,next.gameId);
 // Real normal-cut and rounded-zero records are displayed separately from debt.
 await page.evaluate(async()=>{
  const e=await import('./engine.js'),s=await import('./solo.js'),r=await import('./records.js'),high=n=>n;
  for(const kind of ['cut','empty']){
   const g=s.createSoloGame('あなた',kind==='cut'?'classic':'usdjpy',high);r.ensureGameIdentity(g,{newGame:true});
   for(const [index,leverage] of (kind==='cut'?[100]:[99,95,60]).entries()){
    s.submitSoloOrder(g,{side:'buy',leverage});Object.assign(g,{direction:'down',first:6,second:kind==='cut'?1:3,phase:'market-ready'});s.resolveSoloRound(g,high);
    if(g.phase==='results'){const choice=kind==='cut'||index===2?'fix':'continue';g.cpuDecisions={1:choice,2:choice,3:choice};s.commitSoloDecision(g,s.humanPlayer(g).status==='active'?choice:undefined,high)}
   }
   if(g.players[0].status!==kind)throw Error('zero-exit fixture mismatch');r.ensureGameIdentity(g);const res=await fetch('/api/matches/'+g.gameId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(g.finalRecord)});if(!res.ok)throw Error(`save ${kind}: ${res.status}`);
  }
 });
 await page.evaluate(()=>location.hash='#stats');await page.waitForSelector('[data-feedback-game="used100"]');
 for(const id of ['used100','no100'])assert.equal(await page.locator(`[data-feedback-game="${id}"] [data-feedback-stat="fundsDepleted"]`).innerText(),'1回');
 assert.equal(await page.locator('[data-feedback-game="used100"] [data-feedback-stat="debtExits"]').innerText(),'0回');assert.equal(await page.locator('[data-feedback-game="no100"] [data-feedback-stat="debtExits"]').innerText(),'0回');assert.equal((await state()).gameId,next.gameId);
 assert.deepEqual(errors,[]);console.log('PASS: stage-aware exact trade previews, modal/keyboard and 320/390px no-scroll orders; previous round direction/rate/side/exact profit or loss, zero and gap at 320/390/1280px; current tabletop player ID after a fixed player and direct handoff; huge BigInt profit without overflow; solo-only previous multiplier without rerolls; live six-player scroll cues and choice focus; canonical partial-gap fast-forward facts; fresh replay from final settings; previous saved/failed results retained and retried through real D1.');await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
