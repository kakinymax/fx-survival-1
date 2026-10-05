import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';

const destination = 'mobile/www';
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
  .replace('<span class="beta">仮</span>', '<span class="beta">試作</span>');
await writeFile(`${destination}/index.html`, html);
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty = !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
await writeFile(`${destination}/build-info.json`, JSON.stringify({
  kind: 'mobile-prototype', sourceCommit, dirty, onlineRecords: 'disconnected',
  appId: 'com.kakinymax.fxsurvival.prototype'
}, null, 2) + '\n');
console.log(`Mobile assets: ${destination} (${sourceCommit}); online records disconnected.`);
