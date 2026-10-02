const {chromium}=require('/opt/codex/runtimes/cua/lib/node_modules/playwright-core');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const origin='http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const user='phase4-'+randomUUID(),headers={'oai-authenticated-user-id':user},context=await browser.newContext({viewport:{width:390,height:700},extraHTTPHeaders:headers}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const meter=id=>page.locator(`[data-trip="${id}"]`),stat=(id,key)=>meter(id).locator(`[data-trip-stat="${key}"]`).textContent();
 const read=async()=>{const response=await context.request.get(origin+'/api/trips');assert.equal(response.status(),200);return (await response.json()).trips};
 const ready=()=>page.waitForSelector('[data-trip="a"]');
 const waitCount=(id,n)=>page.waitForFunction(({id,n})=>document.querySelector(`[data-trip="${id}"] [data-trip-stat="plays"]`)?.textContent===`${n}ゲーム`,{id,n});
 const state=()=>page.evaluate(()=>localStorage.getItem('fx-survival-v1'));
 await page.goto(origin);await page.getByRole('link',{name:'戦績',exact:true}).click();await page.getByRole('link',{name:'TRIP',exact:true}).click();await ready();assert.equal(await meter('a').locator('.trip-state').innerText(),'未開始');assert.equal(await meter('b').locator('.trip-state').innerText(),'未開始');assert.equal(await meter('a').locator('[data-trip-stat]').count(),0);
 await meter('b').locator('.trip-settings summary').click();await meter('b').locator('input').fill('今日の練習');await meter('b').getByRole('button',{name:'名前を保存'}).click();await page.waitForFunction(()=>document.querySelector('[data-trip="b"] .trip-name')?.textContent==='今日の練習');assert.equal((await read())[1].startedAt,null);
 await meter('a').getByRole('button',{name:'計測を開始',exact:true}).click();await waitCount('a',0);const startA=(await read())[0].startedAt;assert.equal(await page.locator('#trip-reset-dialog').evaluate(el=>el.open),false);
 // Real engine records and authenticated D1 saves, before/after B begins.
 async function seed(group){return page.evaluate(async group=>{
  const e=await import('./engine.js'),s=await import('./solo.js'),r=await import('./records.js'),high=n=>n,rows=[],stamp=new Date().toISOString();
  const kinds=group==='before'?[...Array(12).fill('win'),'table']:[...Array(15).fill('win'),...Array(5).fill('debt'),'cut','empty','table'];
  for(const [i,kind]of kinds.entries()){
   const table=kind==='table',g=table?e.createGame(['あなた','友人'],'manual'):s.createSoloGame(i%2?'別の名前':'あなた',i%3===0?'tryjpy':'classic',high);
   // Use classic for forced outcomes so the expected balances are exact.
   if(!table&&kind!=='win')g.stage='classic';if(!table&&kind==='win')g.stage='classic';
   r.ensureGameIdentity(g,{newGame:true,now:stamp,id:()=>`${group}-${String(i).padStart(3,'0')}`});
   const leverage=kind==='debt'||kind==='cut'?100:kind==='empty'?50:50;
   if(table)while(g.phase==='order')e.submitOrder(g,{side:'buy',leverage:1});else s.submitSoloOrder(g,{side:'buy',leverage});
   g.direction=['debt','cut','empty'].includes(kind)?'down':'up';g.first=kind==='win'||table?4:6;g.second=kind==='debt'?5:kind==='cut'?3:kind==='empty'?4:null;g.phase='market-ready';
   if(table){e.resolveRound(g);e.commitDecisions(g,{0:'fix',1:'fix'})}else{s.resolveSoloRound(g,high);g.cpuDecisions={1:'fix',2:'fix',3:'fix'};s.commitSoloDecision(g,kind==='win'?'fix':undefined,high)}
   r.ensureGameIdentity(g,{now:stamp});rows.push(g.finalRecord);
  }
  for(const record of rows){const response=await fetch('/api/matches/'+record.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(record)});if(!response.ok)throw Error(`fixture save: ${record.id} ${response.status}`)}
  return rows;
 },group)}
 const beforeRows=await seed('before');await page.reload();await waitCount('a',12);assert.equal(await stat('a','pnlTotal'),'＋300.0万円');assert.equal((await read())[1].startedAt,null);
 await meter('b').getByRole('button',{name:'計測を開始',exact:true}).click();await waitCount('b',0);const startB=(await read())[1].startedAt;assert(startB>startA);assert.equal(await meter('b').locator('.trip-name').innerText(),'今日の練習');
 await seed('after');await page.reload();await waitCount('a',34);await waitCount('b',22);
 for(const [id,expected]of Object.entries({a:{initialTotal:'3,400.0万円',finalTotal:'1,375.0万円',pnlTotal:'−2,025.0万円',wins:'27回',debtExits:'5回'},b:{initialTotal:'2,200.0万円',finalTotal:'−125.0万円',pnlTotal:'−2,325.0万円',wins:'15回',debtExits:'5回'}}))for(const [key,value]of Object.entries(expected))assert.equal(await stat(id,key),value,`${id}.${key}`);
 await meter('a').locator('.trip-records summary').click();assert.equal(await stat('a','fundsDepleted'),'2回');assert.equal(await stat('a','highestFinal'),'125.0万円');assert.equal(await stat('a','maxDebt'),'400.0万円');assert.equal(await stat('a','maxPosition'),'1億円');const all=await read();assert.equal(all[0].startGameId,'before-000');assert.equal(all[1].startGameId,'after-000');
 for(const viewport of [{width:320,height:568},{width:390,height:700},{width:1280,height:900}]){await page.setViewportSize(viewport);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(viewport.width===390){await page.screenshot({path:'/workspace/fx-survival/trips-mobile.png'});await meter('a').screenshot({path:'/workspace/fx-survival/trip-card-mobile.png'})}}
 await page.setViewportSize({width:320,height:568});await page.evaluate(()=>document.documentElement.style.fontSize='32px');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.evaluate(()=>document.documentElement.style.fontSize='');await page.setViewportSize({width:390,height:700});
 await meter('a').getByRole('link',{name:'最初の対象ゲームを見る'}).click();await page.waitForSelector('[data-saved-player]');assert.equal(await page.locator('[data-saved-round]').count(),1);await page.getByRole('link',{name:'← TRIPへ'}).click();await waitCount('a',34);
 // Cancel does not change the boundary; confirmed A reset never affects B.
 await meter('a').getByRole('button',{name:'TRIP Aをリセット'}).click();assert.equal(await page.locator('#trip-reset-dialog').evaluate(el=>el.open),true);await page.locator('#trip-reset-cancel').click();assert.equal((await read())[0].startedAt,startA);await waitCount('a',34);
 await meter('a').getByRole('button',{name:'TRIP Aをリセット'}).click();await page.locator('#trip-reset-confirm').click();await waitCount('a',0);await waitCount('b',22);const resetA=(await read())[0];assert(resetA.startedAt>startB);
 const late={...beforeRows[0],id:'late-upload'};assert.equal((await context.request.put(origin+'/api/matches/'+late.id,{data:late})).status(),200);await page.reload();await waitCount('a',0);await waitCount('b',22);assert.equal((await (await context.request.get(origin+'/api/statistics')).json()).lifetime.plays,35);
 // Names and boundaries survive a new browser/device, rather than local storage.
 const same=await browser.newContext({extraHTTPHeaders:headers});const remote=(await (await same.request.get(origin+'/api/trips')).json()).trips;assert.equal(remote[0].startedAt,resetA.startedAt);assert.equal(remote[1].name,'今日の練習');const other=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':user+'-other'}});assert((await (await other.request.get(origin+'/api/trips')).json()).trips.every(t=>t.startedAt===null));await other.close();
 // A real D1 race permits exactly one update, and stale browser edits are visible.
 const payload=id=>({action:'rename',expectedRevision:resetA.revision,requestId:id,name:'並行更新'});const race=await Promise.all([context.request.put(origin+'/api/trips/a',{data:payload('race-1')}),same.request.put(origin+'/api/trips/a',{data:payload('race-2')})]);assert.deepEqual(race.map(r=>r.status()).sort(),[200,409]);assert.equal((await read())[0].revision,resetA.revision+1);
 const oldB=(await read())[1];assert.equal((await same.request.put(origin+'/api/trips/b',{data:{action:'rename',expectedRevision:oldB.revision,requestId:'remote-b',name:'別端末の名前'}})).status(),200);
 await meter('b').locator('.trip-settings summary').click();await meter('b').locator('input').fill('入力を保持');await meter('b').getByRole('button',{name:'名前を保存'}).click();await page.waitForSelector('.trip-error');assert((await page.locator('.trip-error').innerText()).includes('別の画面'));assert.equal(await meter('b').locator('input').inputValue(),'入力を保持');assert.equal(await page.locator('[data-action="retry-trip"]').count(),0);await page.locator('.trip-error [data-action="reload-trips"]').click();await waitCount('b',22);await meter('b').getByRole('button',{name:'名前を保存'}).click();await page.waitForFunction(()=>document.querySelector('[data-trip="b"] .trip-name')?.textContent==='入力を保持');assert.equal((await read())[1].startedAt,startB);await same.close();
 // Losing the acknowledgement after the reset commits must not reset again.
 let committed=null,first=true;await page.route('**/api/trips/a',async route=>{if(route.request().method()==='PUT'&&first){first=false;const response=await route.fetch();committed=(await response.json()).trip;await route.abort('failed')}else await route.continue()});
 await meter('a').getByRole('button',{name:'TRIP Aをリセット'}).click();await page.locator('#trip-reset-confirm').click();await page.waitForSelector('[data-action="retry-trip"]');assert(committed);await page.locator('[data-action="retry-trip"]').click();await waitCount('a',0);assert.equal((await read())[0].startedAt,committed.startedAt);assert.equal((await read())[0].revision,committed.revision);assert.equal((await read())[1].stats.plays,22);await page.unroute('**/api/trips/a');
 // An interrupted rename keeps its input and can retry the same request safely.
 await meter('a').locator('.trip-settings summary').click();await meter('a').locator('input').fill('100倍を試す');await page.route('**/api/trips/a',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));await meter('a').getByRole('button',{name:'名前を保存'}).click();await page.waitForSelector('[data-action="retry-trip"]');assert.equal(await meter('a').locator('input').inputValue(),'100倍を試す');await page.unroute('**/api/trips/a');await page.locator('[data-action="retry-trip"]').click();await page.waitForFunction(()=>document.querySelector('[data-trip="a"] .trip-name')?.textContent==='100倍を試す');
 // The meter is a separate screen and never changes current private game state.
 await page.getByRole('link',{name:'スタート画面へ'}).click();await page.locator('[data-count="2"]').click();await page.locator('#setup-form button[type="submit"]').click();const current=await state();await page.goto(origin+'/#trips');await waitCount('a',0);assert.equal(await state(),current);await meter('a').getByRole('button',{name:'TRIP Aをリセット'}).click();await page.locator('#trip-reset-cancel').click();assert.equal(await state(),current);await page.getByRole('link',{name:'ゲームに戻る'}).click();await page.waitForSelector('#order-form');assert.equal(await state(),current);
 await page.route('**/api/trips',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));await page.goto(origin+'/#trips');await page.waitForSelector('[data-action="reload-trips"]');assert.equal(await page.locator('[data-trip]').count(),0);assert.equal(await state(),current);await page.unroute('**/api/trips');await page.locator('[data-action="reload-trips"]').click();await waitCount('a',0);assert.equal(await state(),current);
 assert.deepEqual(errors,[]);console.log('PASS: real D1 A/B intervals across 36 games, exact totals and owner/CPU separation, custom names/new-device persistence, first-game link, independent reset/cancel, late-upload exclusion, atomic races and stale edits, lost-ack idempotency, preserved input/retry, mobile/200% text and current-game isolation.');await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
