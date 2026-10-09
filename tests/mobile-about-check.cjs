const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

module.exports = async function checkMobileAbout(browser, base) {
  const context = await browser.newContext({ isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage(), errors = [], remote = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.origin !== new URL(base).origin || url.pathname.startsWith('/api/')) remote.push(request.url());
    });
    await page.goto(base);
    await page.evaluate(() => document.fonts.ready);
    // Full license files must survive the mobile build, including copyright,
    // permission, warranty disclaimers and the Apache appendix/NOTICE.
    const names = ['DOTGOTHIC16-OFL.txt', 'CAPACITOR-MIT.txt', 'CAPACITOR-APP-MIT.txt', 'CORDOVA-NOTICE.txt', 'APACHE-2.0.txt'];
    const licenses = names.map(name => readFileSync(join(__dirname, '../mobile/licenses', name), 'utf8'));
    for (let i = 0; i < names.length; i++) {
      assert.equal(await page.evaluate(async name => (await fetch('/licenses/' + name)).text(), names[i]), licenses[i]);
    }
    await context.setOffline(true);
    const open = page.locator('#mobile-about-open'), dialog = page.locator('#mobile-about');
    const visibleWithinScreen = async () => {
      const rect = await dialog.boundingBox(), viewport = page.viewportSize();
      assert(rect.x >= 0 && rect.x + rect.width <= viewport.width + 1);
      assert(rect.y >= 0 && rect.y + rect.height <= viewport.height + 1);
      assert.equal(await dialog.evaluate(element => element.scrollWidth > element.clientWidth), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    };
    for (const [width, height] of [[320, 568], [375, 667], [390, 600], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await open.tap();
      assert.equal(await page.locator('#mobile-about-close').evaluate(element => element === document.activeElement), true);
      assert.match(await dialog.innerText(), /広告配信・アプリ内課金・アプリ独自の利用状況解析は行いません/);
      await visibleWithinScreen();
      for (const detail of await dialog.locator('details').all()) await detail.locator('summary').tap();
      const displayed = await dialog.locator('pre').allTextContents();
      const normalized = licenses.map(license => license.replace(/\r\n?/g, '\n'));
      assert.deepEqual(displayed, [normalized[0], normalized[1], normalized[2], normalized[3] + '\n\n' + normalized[4]]);
      await visibleWithinScreen();
      // Closing after scrolling a long license must restore focus to the entry.
      await page.locator('#mobile-about-close').tap();
      await page.waitForFunction(() => !document.querySelector('#mobile-about').open);
      await page.waitForFunction(() => document.activeElement.id === 'mobile-about-open');
      for (const detail of await dialog.locator('details').all()) await detail.evaluate(element => element.open = false);
    }
    await page.setViewportSize({ width: 320, height: 568 });
    await page.locator('[data-count="2"]').tap();
    await page.locator('[data-mode="manual"]').tap();
    await page.locator('#setup-form button[type="submit"]').tap();
    await page.locator('[data-side="sell"]').tap();
    await page.locator('#leverage').fill('73');
    const snapshot = await page.evaluate(() => localStorage.getItem('fx-survival-v1'));
    // The footer entry must remain tappable above the fixed order dock. Reading
    // privacy must not submit a secret order or discard its unconfirmed choice.
    await open.tap();
    await visibleWithinScreen();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#mobile-about').open);
    await page.waitForFunction(() => document.activeElement.id === 'mobile-about-open');
    assert.equal(await page.locator('[data-side="sell"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#leverage').inputValue(), '73');
    assert.equal(await page.evaluate(() => localStorage.getItem('fx-survival-v1')), snapshot);
    await page.locator('#order-submit').tap();
    assert.match(await page.locator('.order-player').innerText(), /プレイヤーB/);
    assert.deepEqual(remote, []);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
};
