// Negative control: the same app and CSS, with only the new header guard
// omitted. This checks native smart zoom rather than computed CSS alone.
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import path from 'node:path';

const entry = await readFile('mobile/entry.js', 'utf8');
const importLine = "import { installHeaderGestures } from './header-gestures.js';\n";
const installLine = "installHeaderGestures(document.querySelector('body > header'));\n";
if (!entry.includes(importLine) || !entry.includes(installLine)) throw new Error('Header guard entry points changed; update the negative control');
await build({ stdin: { contents: entry.replace(importLine, '').replace(installLine, ''),
  resolveDir: path.resolve('mobile'), sourcefile: 'entry.js' },
  outfile: 'ios/App/App/public/mobile.js', bundle: true, format: 'esm',
  platform: 'browser', target: ['safari15.4', 'chrome105'] });
