const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');

(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH }
      : existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}),
    args: ['--no-sandbox'] });
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
  await page.evaluate(() => document.fonts.ready);
  assert.match(await page.locator('.prototype-note').innerText(), /未接続/);
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
  assert.match(await page.locator('[data-record-status]').innerText(), /送信待ち/);
  assert.doesNotMatch(await page.locator('[data-record-status]').innerText(), /保存しました/);
  const drafts = await page.evaluate(() => JSON.parse(localStorage.getItem('fx-survival-pending-records-v1')));
  assert.deepEqual(drafts.records, [completed.finalRecord]);
  await context.setOffline(false); await page.reload();
  assert.deepEqual((await game()).finalRecord, completed.finalRecord);
  await page.locator('.ending-actions a[href="#stats"]').click();
  await page.locator('h1').filter({ hasText: 'オンライン戦績は準備中' }).waitFor();
  assert.match(await page.locator('h1').innerText(), /オンライン戦績は準備中/);
  for (const route of ['#trips', '#records', '#modes', '#legends', '#match/missing']) {
    await page.evaluate(hash => { location.hash = hash; }, route);
    await page.waitForTimeout(50);
    assert.match(await page.locator('h1').innerText(), /オンライン戦績は準備中/);
  }
  await page.locator('a[href="#"]').click();
  await page.locator('.end-surface').waitFor();
  assert.equal((await game()).phase, 'end');
  await page.locator('[data-action="replay"]').click();
  await page.locator('[data-side="sell"]').click(); await page.locator('#leverage').fill('100');
  await page.reload();
  assert.equal((await game()).round, 1);
  assert.equal(await page.locator('[data-side][aria-pressed="true"]').count(), 0);
  assert.equal(await page.locator('#leverage').inputValue(), '1');
  await page.locator('[data-action="reset"]').click(); await page.locator('#reset-confirm').click();
  assert.match(await page.locator('[data-pending-records]').innerText(), /1件/);
  await page.locator('[data-play="solo"]').click();
  assert.match(await page.locator('[data-cpu-intro-status]').innerText(), /未接続/);
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
  await page.setViewportSize({ width: 844, height: 390 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(apiRequests, []); assert.deepEqual(external, []); assert.deepEqual(errors, []);
  if (process.env.MOBILE_SCREENSHOT_PATH) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: process.env.MOBILE_SCREENSHOT_PATH, fullPage: true });
  }
  await browser.close();
  console.log('PASS: mobile bundle, 3 phone sizes/insets, offline secret handoff, exact pending record/restart, unsent status, stats routes, replay/draft reset, CPU draw/finish, landscape, no API/external requests or JS errors.');
})().catch(error => { console.error(error); process.exit(1); });
