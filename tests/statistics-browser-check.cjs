const {chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const origin='http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const user='phase2-'+randomUUID(),context=await browser.newContext({viewport:{width:390,height:700},extraHTTPHeaders:{'oai-authenticated-user-id':user}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const stat=key=>page.locator(`[data-stat="${key}"]`).innerText();
 const ready=()=>page.waitForSelector('[data-stat="plays"]');
 const state=()=>page.evaluate(()=>localStorage.getItem('fx-survival-v1'));
 await page.goto(origin);await page.getByRole('link',{name:'戦績',exact:true}).click();await ready();assert.equal(await stat('plays'),'0回');assert.equal(await stat('winRate'),'—');assert.equal(await page.locator('.stats-game').count(),0);assert((await page.locator('.stats-scope').innerText()).includes('本人未指定'));
 // Seed genuine engine-produced games through the real authenticated write API.
 // 51 solo games exceed two read pages; tabletop names deliberately match the user.
 const fixture=await page.evaluate(async()=>{
  const e=await import('./engine.js'),s=await import('./solo.js'),r=await import('./records.js'),high=n=>n,records=[];
  const stamp='2026-10-02T10:00:00.000Z';
  for(let i=0;i<53;i++){
   const table=i>=51,g=table?e.createGame(['あなた','友人'],'manual'):s.createSoloGame(i%2?'別の名前':'あなた','classic',high);
   r.ensureGameIdentity(g,{newGame:true,now:stamp,id:()=>`game-${String(i).padStart(3,'0')}`});
   const debt=!table&&i>=31;
   if(table)while(g.phase==='order')e.submitOrder(g,{side:'buy',leverage:1});else s.submitSoloOrder(g,{side:'buy',leverage:debt?100:50});
   g.direction=debt?'down':'up';g.first=debt?6:4;g.second=debt?5:null;g.phase='market-ready';
   if(table){e.resolveRound(g);e.commitDecisions(g,{0:'fix',1:'fix'})}
   else {s.resolveSoloRound(g,high);g.cpuDecisions={1:'fix',2:'fix',3:'fix'};s.commitSoloDecision(g,debt?undefined:'fix',high)}
   r.ensureGameIdentity(g,{now:stamp});records.push(g.finalRecord);
  }
  for(const record of records){const response=await fetch('/api/matches/'+record.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(record)});if(!response.ok)throw Error(`fixture save: ${record.id} ${response.status}`)}
  return {last:records.at(-1),records};
 });
 await page.reload();await ready();
 assert.equal(await stat('plays'),'51回');assert.equal(await stat('wins'),'31回');assert.equal(await stat('winRate'),'60.8%');assert.equal(await stat('initialTotal'),'5,100.0万円');assert.equal(await stat('finalTotal'),'−4,125.0万円');assert.equal(await stat('pnlTotal'),'−9,225.0万円');assert.equal(await stat('debtExits'),'20回');
 assert.equal(await page.locator('.stats-game').count(),10);assert.equal(await page.locator('.stats-game').first().getAttribute('data-history-id'),'game-052');assert.equal(await page.locator('.stats-game').last().getAttribute('data-history-id'),'game-043');assert((await page.locator('.stats-history-count').innerText()).includes('53ゲーム'));assert((await page.locator('.stats-history-count').innerText()).includes('最新10件'));
 await page.locator('.stats-detail summary').first().click();await page.locator('.stats-detail summary').last().click();assert.equal(await stat('averageFinal'),'−80.9万円');assert.equal(await stat('averagePnl'),'−180.9万円');assert.equal(await stat('maxDebt'),'400.0万円');assert.equal(await stat('uses100'),'20回');assert.equal(await stat('uses50Plus'),'51回');assert.equal(await stat('highestFinal'),'125.0万円');
 await page.locator('.stats-game').first().locator('summary').click();assert.equal(await page.locator('.stats-game').first().locator('.stats-roster-row').count(),2);assert.equal(await page.locator('.stats-game').first().locator('.cpu-tag').count(),0);
 const solo=page.locator('.stats-game').nth(2);await solo.locator('summary').click();assert.equal(await solo.locator('.stats-roster-row .cpu-tag').count(),4);assert((await solo.innerText()).includes('負債退場'));assert((await solo.innerText()).includes('CPU'));
 for(const viewport of [{width:320,height:568},{width:390,height:700},{width:1280,height:900}]){await page.setViewportSize(viewport);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(viewport.width!==390)await page.screenshot({path:`/workspace/fx-survival/statistics-${viewport.width}.png`,fullPage:true})}
 await page.setViewportSize({width:320,height:568});await page.evaluate(()=>document.documentElement.style.fontSize='32px');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.evaluate(()=>document.documentElement.style.fontSize='');
 // The same game ID may exist for another account, but its records never leak.
 const other=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':user+'-other'}}),otherPage=await other.newPage();await otherPage.goto(origin);
 await otherPage.evaluate(async(record)=>{const response=await fetch('/api/matches/'+record.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(record)});if(!response.ok)throw Error('other save failed')},fixture.records[0]);
 await otherPage.getByRole('link',{name:'戦績',exact:true}).click();await otherPage.waitForSelector('[data-stat="plays"]');assert.equal(await otherPage.locator('[data-stat="plays"]').innerText(),'1回');assert.equal(await otherPage.locator('.stats-game').count(),1);await other.close();
 // Visiting history leaves private order state untouched and restores the game.
 await page.getByRole('link',{name:'スタート画面へ'}).click();await page.locator('[data-count="2"]').click();await page.locator('#setup-form button[type="submit"]').click();const before=await state();await page.goto(origin+'/#stats');await ready();assert.equal(await state(),before);await page.getByRole('link',{name:'ゲームに戻る'}).click();assert.equal(await state(),before);assert.equal(await page.locator('#order-form').count(),1);assert.equal(await page.locator('[data-action="draw-direction"]').count(),0);
 // Read failures show no cached/partial totals; retry resumes without a game reset.
 await page.route('**/api/statistics',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"unavailable"}'}));await page.goto(origin+'/#stats');await page.waitForSelector('[data-action="reload-statistics"]');assert.equal(await page.locator('[data-stat]').count(),0);assert.equal(await state(),before);await page.unroute('**/api/statistics');await page.locator('[data-action="reload-statistics"]').click();await ready();assert.equal(await stat('plays'),'51回');assert.equal(await state(),before);
 // A pending, unsaved game is not an extra lifetime record. A later save reloads
 // the current statistics page, with the same completed snapshot and identity.
 await page.goto(origin+'/engine.js');
 await page.evaluate(async()=>{const e=await import('./engine.js'),s=await import('./solo.js'),r=await import('./records.js'),high=n=>n,g=s.createSoloGame('あなた','classic',high);r.ensureGameIdentity(g,{newGame:true});s.submitSoloOrder(g,{side:'buy',leverage:50});g.direction='up';g.first=4;g.second=null;g.phase='market-ready';s.resolveSoloRound(g,high);g.cpuDecisions={1:'fix',2:'fix',3:'fix'};s.commitSoloDecision(g,'fix',high);r.ensureGameIdentity(g);localStorage.setItem('fx-survival-v1',JSON.stringify(g))});
 await page.route('**/api/matches/*',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"unavailable"}'}));await page.goto(origin);await page.waitForSelector('[data-action="retry-record"]');await page.getByRole('link',{name:'戦績を見る'}).click();await ready();assert.equal(await stat('plays'),'51回');assert((await page.locator('.stats-pending').innerText()).includes('1件'));await page.unroute('**/api/matches/*');await page.locator('.stats-pending button').click();await page.waitForFunction(()=>document.querySelector('[data-stat="plays"]')?.textContent==='52回');assert.equal(await page.locator('.stats-pending').count(),0);await page.getByRole('link',{name:'ゲームに戻る'}).click();assert((await page.locator('[data-record-status]').innerText()).includes('保存しました'));assert.equal(JSON.parse(await state()).phase,'end');
 assert.deepEqual(errors,[]);console.log('PASS: real D1 all-game aggregation across 53 records, exact totals and averages, CPU/tabletop separation, timestamp tie pagination, other-account isolation, expandable recent history, mobile/200% text, game restoration, read retry and newly saved results.');await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
