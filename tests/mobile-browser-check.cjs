const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const { existsSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

(async () => {
  const launch = { headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH }
      : existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}),
    args: ['--no-sandbox'] };
  const browser = await chromium.launch(launch);
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage(), errors = [], apiRequests = [], external = [];
  const base = process.env.MOBILE_BASE_URL || 'http://127.0.0.1:4174';
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) apiRequests.push(url.pathname);
    if (url.origin !== new URL(base).origin && !url.protocol.startsWith('data')) external.push(request.url());
  });
  const game = () => page.evaluate(() => JSON.parse(localStorage.getItem('fx-survival-v1')));
  const localRead = path => page.evaluate(async path => (await FX_SURVIVAL_BUILD.apiFetch(path)).json(), path);
  const submit = async (side = 'buy') => { await page.locator(`[data-side="${side}"]`).click(); await page.locator('#order-submit').click(); };
  const layout = async () => {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const dock = await page.locator('.turn-actions').boundingBox();
    assert(dock.y + dock.height <= page.viewportSize().height + 1);
    assert(dock.y >= 0);
    const choice = await page.locator('[data-side="buy"]').boundingBox();
    assert(choice.y >= 24 && choice.y + choice.height <= dock.y);
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page.evaluate(()=>{
    window.mobileCspBlocked=false;
    document.addEventListener('securitypolicyviolation',()=>{window.mobileCspBlocked=true},{once:true});
    const script=document.createElement('script');script.textContent='window.mobileInlineExecuted=true';document.body.append(script);
  });
  await page.waitForFunction(()=>window.mobileCspBlocked);
  assert.equal(await page.evaluate(()=>window.mobileInlineExecuted),undefined);
  await page.evaluate(() => document.fonts.ready);
  assert.match(await page.locator('.prototype-note').innerText(), /この端末に保存/);
  assert.match(await page.locator('.prototype-note').innerText(), /削除・データ消去/);
  await page.locator('#rules-open').click();
  const rules = await page.locator('#rules').boundingBox();
  assert(rules.y >= 0 && rules.y + rules.height <= 844);
  await page.locator('#rules-close').click();
  await page.locator('[data-count="2"]').click();
  await page.locator('[data-mode="manual"]').click();
  await page.locator('#setup-form button[type="submit"]').click();
  // Emulate SystemBars insets, including the fallback for older Android WebViews.
  await page.evaluate(() => {
    for (const [side, value] of Object.entries({ top: 24, bottom: 24, left: 0, right: 0 }))
      document.documentElement.style.setProperty(`--safe-area-inset-${side}`, `${value}px`);
  });
  for (const [width, height] of [[320, 568], [390, 600], [390, 844]]) {
    await page.setViewportSize({ width, height }); await layout();
  }
  await context.setOffline(true);
  await page.locator('[data-side="sell"]').click(); await page.locator('#leverage').fill('73');
  await submit('buy');
  assert.match(await page.locator('.order-player').innerText(), /プレイヤーB/);
  assert.equal(await page.locator('[data-side][aria-pressed="true"]').count(), 0);
  assert.equal(await page.locator('#leverage').inputValue(), '1');
  await submit('sell');
  await page.locator('[data-direction="up"]').click(); await page.locator('[data-face="1"]').click();
  for (let id = 0; id < 2; id++) await page.locator(`[data-player="${id}"][data-decision="fix"]`).click();
  await page.locator('[data-action="commit-decisions"]').click();
  const completed = await game();
  assert.equal(completed.phase, 'end');
  await page.waitForFunction(() => document.querySelector('[data-record-status]')?.textContent.includes('この端末にゲームの戦績を保存しました'));
  assert.deepEqual((await localRead('/api/matches/' + completed.finalRecord.id)).record, completed.finalRecord);
  assert.equal(await page.evaluate(() => localStorage.getItem('fx-survival-pending-records-v1')), null);
  await context.setOffline(false); await page.reload();
  assert.deepEqual((await game()).finalRecord, completed.finalRecord);
  await page.locator('.ending-actions a[href="#stats"]').click();
  await page.locator(`[data-history-id="${completed.finalRecord.id}"]`).waitFor();
  assert.equal(await page.locator('[data-stat="plays"]').innerText(), '0回');
  for (const [route, selector] of [['#trips', '[data-trip="a"]'], ['#records', '.record-context'], ['#modes', '[data-mode="classic"]'], ['#legends', '.legend-filter'], ['#match/missing', '.stats-message[role="alert"]']]) {
    await page.evaluate(hash => { location.hash = hash; }, route);
    await page.locator(selector).waitFor();
    assert.doesNotMatch(await page.locator('h1').innerText(), /準備中/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await page.locator('#app a[href="#"]').click();
  await page.locator('.end-surface').waitFor();
  assert.equal((await game()).phase, 'end');
  await page.locator('[data-action="replay"]').click();
  await page.locator('[data-side="sell"]').click(); await page.locator('#leverage').fill('100');
  await page.reload();
  assert.equal((await game()).round, 1);
  assert.equal(await page.locator('[data-side][aria-pressed="true"]').count(), 0);
  assert.equal(await page.locator('#leverage').inputValue(), '1');
  await page.locator('[data-action="reset"]').click(); await page.locator('#reset-confirm').click();
  assert.equal(await page.locator('[data-pending-records]').count(), 0);
  await page.locator('[data-play="solo"]').click();
  assert.doesNotMatch(await page.locator('[data-cpu-intro-status]').innerText(), /未接続/);
  await page.locator('#setup-form button[type="submit"]').click();
  await submit();
  // CPU orders are already committed. Force only the three market draws so the
  // mobile bundle always exercises the separate acute-move/gap button.
  await page.evaluate(() => {
    const original = crypto.getRandomValues.bind(crypto), values = [0, 5, 4];
    globalThis.mobileTestDraws = 0;
    crypto.getRandomValues = array => {
      if (values.length) { array[0] = values.shift(); globalThis.mobileTestDraws++; return array; }
      return original(array);
    };
  });
  const draw = async () => {
    for (const action of ['draw-direction', 'draw-movement']) {
      await page.locator(`[data-action="${action}"]`).click();
    }
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('fx-survival-v1')).phase === 'movement-result');
    if (await page.locator('[data-action="draw-shock"]').count()) await page.locator('[data-action="draw-shock"]').click();
    await page.locator('[data-action="settle-market"]').click();
  };
  await draw();
  assert.equal(await page.evaluate(() => globalThis.mobileTestDraws), 3);
  assert.equal((await game()).history.at(-1).gap, true);
  await page.locator('[data-action="solo-fix"]').click();
  if ((await game()).phase !== 'end') await page.locator('[data-action="fast-forward"]').first().click();
  assert.equal((await game()).phase, 'end');
  assert.equal((await game()).finalRecord.maxRounds, 12);
  assert.equal((await game()).finalRecord.playMode, 'solo');
  await page.waitForFunction(() => document.querySelector('[data-record-status]')?.textContent.includes('この端末にゲームの戦績を保存しました'));
  await page.waitForFunction(() => document.querySelector('[data-personal-bests]')?.textContent.includes('初記録'));
  const solo = (await game()).finalRecord;
  assert.equal((await localRead('/api/statistics')).lifetime.plays, 1);
  await page.evaluate(() => { location.hash = '#trips'; });
  await page.locator('[data-trip="a"]').waitFor();
  await page.locator('[data-action="trip-reset"][data-meter="a"]').click();
  await page.locator('[data-trip="a"] [data-trip-start]').waitFor();
  await page.locator('[data-trip="a"] .trip-settings summary').click();
  await page.locator('#trip-name-a').fill('練習 <b>');
  await page.locator('[data-trip-form="a"] button').click();
  await page.locator('.trip-name').filter({ hasText: '練習 <b>' }).waitFor();
  assert.equal(await page.locator('.trip-name b').count(), 0);
  const settings = (await localRead('/api/trips')).trips;
  const boundary = settings[0].startedAt;
  assert.equal(settings[1].startedAt, null);
  assert.equal(settings[0].stats.plays, 0);

  // Import the old paused outbox using the real IndexedDB archive. No record
  // leaves the queue until its transaction has committed and been acknowledged.
  const legacy = { ...completed.finalRecord, id: 'legacy-imported', stage: { id: 'classic', name: 'クラシック' } };
  await page.evaluate(r => localStorage.setItem('fx-survival-pending-records-v1', JSON.stringify({ version: 1, records: [r] })), legacy);
  await page.reload();
  await page.waitForFunction(() => localStorage.getItem('fx-survival-pending-records-v1') === null);
  assert.deepEqual((await localRead('/api/matches/legacy-imported')).record, legacy);

  const writeResult = (r, path) => page.evaluate(async ({ r, path }) => {
    const response = await FX_SURVIVAL_BUILD.apiFetch(path ?? '/api/matches/' + r.id, { method: 'PUT', body: JSON.stringify(r) });
    return { status: response.status, body: await response.json() };
  }, { r, path });
  const late = { ...solo, id: 'late-upload', startedAt: null, endedAt: new Date(Date.parse(boundary) - 1).toISOString() };
  const after = { ...solo, id: 'after-boundary', startedAt: null, endedAt: new Date(Date.parse(boundary) + 1).toISOString() };
  assert.equal((await writeResult(late)).status, 200); assert.equal((await writeResult(after)).status, 200);
  assert.equal((await localRead('/api/trips')).trips[0].stats.plays, 1);

  const races = await page.evaluate(async r => Promise.all([r, { ...r, endedAt: new Date(Date.parse(r.endedAt) + 1).toISOString() }].map(async r => {
    return (await FX_SURVIVAL_BUILD.apiFetch('/api/matches/' + r.id, { method: 'PUT', body: JSON.stringify(r) })).status;
  })), { ...legacy, id: 'concurrent-match' });
  assert.deepEqual(races.sort(), [200, 409]);
  const tripRaces = await page.evaluate(async expectedRevision => Promise.all(['FIRST', 'SECOND'].map(async name => {
    return (await FX_SURVIVAL_BUILD.apiFetch('/api/trips/a', { method: 'PUT', body: JSON.stringify({ action: 'rename', expectedRevision, requestId: name, name }) })).status;
  })), settings[0].revision);
  assert.deepEqual(tripRaces.sort(), [200, 409]);
  const currentTrip = (await localRead('/api/trips')).trips[0];
  const operation = { action: 'rename', expectedRevision: currentTrip.revision, requestId: 'same-operation', name: 'RETRY' };
  const first = await writeResult(operation, '/api/trips/a'), retry = await writeResult(operation, '/api/trips/a');
  assert.equal(first.status, 200); assert.deepEqual(retry, first);
  assert.equal((await writeResult({ ...operation, name: 'DIFFERENT' }, '/api/trips/a')).status, 409);
  assert.equal((await localRead('/api/trips')).trips[1].revision, 0);

  // A transaction aborted after add succeeds must never receive a save ack.
  const aborted = await page.evaluate(async r => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function(value, ...args) {
      const request = original.call(this, value, ...args);
      if (value.id === 'aborted-match') request.addEventListener('success', () => this.transaction.abort());
      return request;
    };
    try { return (await FX_SURVIVAL_BUILD.apiFetch('/api/matches/' + r.id, { method: 'PUT', body: JSON.stringify(r) })).status; }
    finally { IDBObjectStore.prototype.add = original; }
  }, { ...legacy, id: 'aborted-match' });
  assert.equal(aborted, 503);
  assert.equal((await localRead('/api/matches/aborted-match')).record, undefined);

  // Exercise large BigInt amounts and real archive pagination beyond twenty.
  const soloEngine = await import('../dist/solo.js'), records = await import('../dist/records.js');
  const big = soloEngine.createSoloGame('同じ名前', 'tryjpy', () => 1);
  records.ensureGameIdentity(big, { id: () => 'big-match' });
  for (let round = 1; round <= 12; round++) {
    soloEngine.submitSoloOrder(big, { side: 'buy', leverage: 100 });
    Object.assign(big, { direction: 'up', first: 6, second: 6, phase: 'market-ready' });
    soloEngine.resolveSoloRound(big, () => 1);
    if (big.phase === 'results') soloEngine.commitSoloDecision(big, 'continue', () => 1);
  }
  records.ensureGameIdentity(big);
  for (let i = 0; i < 22; i++) assert.equal((await writeResult({ ...big.finalRecord, id: `large-${String(i).padStart(2, '0')}` })).status, 200);
  const stats = await localRead('/api/statistics');
  assert.equal(stats.lifetime.highestFinal, String(1000n * 21n ** 12n));
  assert.equal(stats.recentGames.length, 10); assert.equal(stats.lifetime.plays, 25);
  const firstPage = await localRead('/api/legends?scope=self&event=hundredMillion');
  assert.equal(firstPage.entries.length, 20); assert(firstPage.nextCursor);
  const secondPage = await localRead('/api/legends?scope=self&event=hundredMillion&cursor=' + firstPage.nextCursor);
  assert.equal(secondPage.entries.length, 2); assert.equal(secondPage.nextCursor, null);
  assert.equal(new Set([...firstPage.entries, ...secondPage.entries].map(e => e.gameId)).size, 22);
  for (const [width, height] of [[320, 568], [390, 600], [390, 844]]) {
    await page.setViewportSize({ width, height });
    for (const [hash, selector] of [['#stats', '[data-stat="plays"]'], ['#records', '.record-context'], ['#trips', '[data-trip="a"]'], ['#modes', '[data-mode="classic"]'], ['#legends', '.legend-filter']]) {
      await page.evaluate(hash => { location.hash = hash; }, hash); await page.locator(selector).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${hash} ${width}x${height}`);
    }
  }
  await page.setViewportSize({ width: 844, height: 390 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  // Reopening rechecks the currently retained final snapshot, even if its
  // saved flag survived the archive disappearing. Never trust that flag alone.
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('fx-survival-records-v1');
    request.onsuccess = resolve; request.onerror = () => reject(request.error);
  }));
  await page.reload();
  await page.waitForFunction(async id => (await FX_SURVIVAL_BUILD.apiFetch('/api/matches/' + id)).ok, solo.id);
  assert.deepEqual((await localRead('/api/matches/' + solo.id)).record, solo);
  const unavailable = await browser.newContext();
  await unavailable.addInitScript(() => Object.defineProperty(window, 'indexedDB', { value: undefined }));
  const unavailablePage = await unavailable.newPage();
  await unavailablePage.goto(base + '/#stats');
  await unavailablePage.locator('.stats-message[role="alert"]').waitFor();
  assert.equal(await unavailablePage.locator('[data-stat="plays"]').count(), 0);
  await unavailable.close();
  assert.deepEqual(apiRequests, []); assert.deepEqual(external, []); assert.deepEqual(errors, []);
  if (process.env.MOBILE_SCREENSHOT_PATH) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: process.env.MOBILE_SCREENSHOT_PATH, fullPage: true });
  }
  await browser.close();
  // A real browser-process restart must reopen the committed archive on disk.
  const profile = mkdtempSync(join(tmpdir(), 'fx-survival-local-records-'));
  try {
    let persistent = await chromium.launchPersistentContext(profile, launch);
    let persistentPage = persistent.pages()[0]; await persistentPage.goto(base);
    await persistentPage.waitForFunction(() => !!globalThis.FX_SURVIVAL_BUILD);
    assert.equal(await persistentPage.evaluate(async r => (await FX_SURVIVAL_BUILD.apiFetch('/api/matches/' + r.id, { method: 'PUT', body: JSON.stringify(r) })).status, legacy), 200);
    await persistent.close();
    persistent = await chromium.launchPersistentContext(profile, launch);
    persistentPage = persistent.pages()[0]; await persistentPage.goto(base + '/#stats');
    await persistentPage.locator('[data-history-id="legacy-imported"]').waitFor();
    assert.deepEqual(await persistentPage.evaluate(async () => (await (await FX_SURVIVAL_BUILD.apiFetch('/api/matches/legacy-imported')).json()).record), legacy);
    await persistent.close();
  } finally { rmSync(profile, { recursive: true, force: true }); }
  console.log('PASS: mobile offline games/full statistics, actual IndexedDB commit/abort/concurrent writes, old outbox migration, TRIP boundaries/retry/conflict, exact BigInt, pagination, process restart, 3 phone sizes, landscape, no API/external requests or JS errors.');
})().catch(error => { console.error(error); process.exit(1); });
