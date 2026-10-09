import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';

const destination = 'mobile/www';
const config = JSON.parse(await readFile('capacitor.config.json', 'utf8'));
const displayName = config.appName.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const entry of await readdir('dist', { withFileTypes: true })) {
  if (entry.isDirectory() || entry.name !== 'style.css') continue;
  await cp(`dist/${entry.name}`, `${destination}/${entry.name}`);
}
await cp('dist/fonts', `${destination}/fonts`, { recursive: true });
await cp('mobile/mobile.css', `${destination}/mobile.css`);
await cp('mobile/unsupported.html', `${destination}/unsupported.html`);
await build({ entryPoints: ['mobile/entry.js'], outfile: `${destination}/mobile.js`, bundle: true,
  format: 'esm', platform: 'browser', target: ['safari15.4', 'chrome105'] });
let html = await readFile('dist/index.html', 'utf8');
html = html.replace('src="./app.js"', 'src="./mobile.js"')
  .replace('<script type="module"', '<link rel="stylesheet" href="./mobile.css"><script type="module"')
  .replace(/<title>[^<]*<\/title>/, `<title>${displayName} — 対面・CPU対戦</title>`)
  .replace('FXサバイバル <span class="beta">仮</span>', `${displayName} <span class="beta">テスト</span>`);
await writeFile(`${destination}/index.html`, html);
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty = !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
await writeFile(`${destination}/build-info.json`, JSON.stringify({
  kind: 'mobile-local', sourceCommit, dirty, records: 'device-indexeddb', onlineRecords: 'disabled',
  appId: config.appId, appName: config.appName
}, null, 2) + '\n');
console.log(`Mobile assets: ${destination} (${sourceCommit}); records saved on this device.`);
