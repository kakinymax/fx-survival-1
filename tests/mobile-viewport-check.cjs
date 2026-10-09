const assert = require('node:assert/strict');

module.exports = async function checkMobileViewport(browser, base) {
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce'
  });
  try {
    const page = await context.newPage(), errors = [], remote = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.origin !== new URL(base).origin || url.pathname.startsWith('/api/')) remote.push(request.url());
    });
    await page.goto(base);
    await page.evaluate(() => document.fonts.ready);
    const doubleTap = async (selector, edge = false) => {
      const target = page.locator(selector);
      await target.scrollIntoViewIfNeeded();
      const rect = await target.boundingBox();
      const point = edge ? { x: rect.x + 2, y: rect.y + rect.height - 2 }
        : { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      // Check the element actually hit, not just the document root: WKWebView
      // still smart-zoomed the header when only the root had manipulation.
      const hit = await page.evaluate(({ x, y }) => {
        const element = document.elementFromPoint(x, y);
        return { tag: element?.tagName, action: element && getComputedStyle(element).touchAction };
      }, point);
      assert.equal(hit.action, 'manipulation', `Double-tap target ${selector} (${hit.tag}) lacks direct smart-zoom suppression`);
      for (let tap = 0; tap < 2; tap++) await page.touchscreen.tap(point.x, point.y);
      assert.equal(await page.evaluate(() => visualViewport.scale), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    };
    for (const [width, height] of [[320, 568], [375, 667], [390, 600], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await doubleTap('.brand-mark');
      await doubleTap('.brand > div');
      await doubleTap('.brand small');
      await doubleTap('.beta');
      await doubleTap('body > header', true);
      await doubleTap('.prototype-note');
      await doubleTap('footer span');
      await page.locator('#rules-open').tap();
      await doubleTap('#rules h2');
      await doubleTap('#rules > p:first-of-type');
      await page.locator('#rules-close').tap();
    }
    await page.setViewportSize({ width: 375, height: 667 });
    await page.locator('[data-count="2"]').tap();
    await page.locator('[data-mode="manual"]').tap();
    await page.locator('#setup-form button[type="submit"]').tap();
    const cdp = await context.newCDPSession(page);
    const visibleDock = () => page.waitForFunction(() => {
      const dock = document.querySelector('.turn-actions');
      if (!dock) return false;
      const rect = dock.getBoundingClientRect(), v = visualViewport;
      return rect.left >= v.offsetLeft - 1 && rect.right <= v.offsetLeft + v.width + 1
        && rect.top >= v.offsetTop - 1 && rect.bottom <= v.offsetTop + v.height + 1
        && [...dock.querySelectorAll('button')].every(button => {
          const r = button.getBoundingClientRect();
          return r.left >= rect.left && r.right <= rect.right && r.top >= rect.top && r.bottom <= rect.bottom;
        });
    }, null, { timeout: 2000 });
    const zoom = async scale => {
      // Chromium page scaling exercises a real visualViewport. It does not
      // claim to reproduce iOS WKWebView's native smart-zoom gesture.
      await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: scale });
      await visibleDock();
    };
    for (const [width, height] of [[320, 568], [375, 667], [390, 600], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await visibleDock();
      await doubleTap('.brand-mark');
      await doubleTap('.brand > div');
      await doubleTap('body > header', true);
      await doubleTap('[data-side="buy"]');
      assert.equal(await page.locator('[data-side="buy"]').getAttribute('aria-pressed'), 'true');
      await doubleTap('[data-side="sell"]');
      assert.equal(await page.locator('[data-side="sell"]').getAttribute('aria-pressed'), 'true');
      await doubleTap('.privacy-hint');
      assert.equal(await page.evaluate(() => visualViewport.scale), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await zoom(1.5);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 220, y: 180 }] });
      for (let x = 210; x >= 100; x -= 10) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 180 }] });
        await new Promise(resolve => setTimeout(resolve, 16));
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForFunction(() => visualViewport.offsetLeft > 0);
      await visibleDock();
      await zoom(1.1); // Also cover a partly restored scale, rather than just full zoom.
      await zoom(1);
      await page.evaluate(() => scrollTo(0, 0));
      await page.locator('#leverage').focus();
      assert(await page.locator('#leverage').evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 16));
      // The reduced viewport also covers a short keyboard-visible layout.
      await page.setViewportSize({ width, height: 320 });
      await visibleDock();
      await page.locator('#leverage').blur();
      await page.setViewportSize({ width, height });
      await visibleDock();
    }
    await page.setViewportSize({ width: 375, height: 667 });
    await page.locator('#order-submit').tap();
    assert.match(await page.locator('.order-player').innerText(), /プレイヤーB/);
    assert.equal(await page.locator('[data-side][aria-pressed="true"]').count(), 0);
    await page.locator('[data-side="sell"]').tap();
    await page.locator('#order-submit').tap();
    await visibleDock();
    await doubleTap('.orders-heading h1');
    await zoom(1.5); await zoom(1);
    await page.locator('[data-direction="up"]').tap();
    await page.locator('[data-face="1"]').tap();
    await visibleDock();
    await doubleTap('.settlement-heading h1');
    await zoom(1.5); await zoom(1);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await visibleDock();
    for (let id = 0; id < 2; id++) await page.locator(`[data-player="${id}"][data-decision="fix"]`).tap();
    await page.locator('[data-action="commit-decisions"]').tap();
    await page.locator('.end-surface').waitFor();
    await page.locator('.ending-actions a[href="#stats"]').tap();
    await page.locator('[data-stat="plays"]').waitFor();
    await page.evaluate(() => scrollTo(0, 0));
    await doubleTap('.brand > div');
    await doubleTap('.stats-top h1');
    assert.equal(await page.evaluate(() => visualViewport.scale), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    // CSS permits pan/pinch and avoids blanket viewport zoom restrictions.
    // Native WKWebView gesture behavior still needs iPhone verification.
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction), 'manipulation');
    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');
    assert.doesNotMatch(viewportMeta, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\D|$)/);
    await page.locator('#app a[href="#"]').tap();
    await page.locator('[data-action="reset"]').tap();
    await page.locator('#reset-confirm').tap();
    await page.locator('[data-play="solo"]').tap();
    await page.locator('#setup-form button[type="submit"]').tap();
    await page.locator('[data-side="sell"]').tap();
    await page.locator('#order-submit').tap();
    // CPU orders are already committed; make only the market draws predictable.
    await page.evaluate(() => {
      const original = crypto.getRandomValues.bind(crypto), values = [0, 0];
      crypto.getRandomValues = array => {
        if (values.length) { array[0] = values.shift(); return array; }
        return original(array);
      };
      document.documentElement.style.setProperty('--safe-area-inset-top', '24px');
      document.documentElement.style.setProperty('--safe-area-inset-bottom', '24px');
    });
    await page.locator('[data-action="draw-direction"]').tap();
    await page.locator('[data-action="draw-movement"]').tap();
    await page.locator('[data-action="settle-market"]:not([disabled])').waitFor();
    await visibleDock();
    await zoom(1.5);
    // Navigate while zoomed to verify a newly rendered action dock also fits.
    await page.evaluate(() => document.querySelector('[data-action="settle-market"]').click());
    await page.locator('[data-action="solo-continue"]').waitFor();
    await visibleDock();
    await zoom(1);
    await page.setViewportSize({ width: 667, height: 375 });
    await visibleDock();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 375, height: 667 });
    await visibleDock();
    assert.deepEqual(errors, []); assert.deepEqual(remote, []);
  } finally { await context.close(); }
};
