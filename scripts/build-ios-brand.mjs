// Reproduce iPhone artwork from the game's own pixel glyphs. No external font,
// image download, drawing package or generated image is needed by this script.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('dist/market-raster.js', root), 'utf8');
const glyphs = ['F', 'X'].map(letter => {
  const rows = source.match(new RegExp(`'${letter}':(\\[[^\\]]+\\])`))?.[1];
  if (!rows) throw new Error(`Missing ${letter} pixel glyph`);
  return JSON.parse(rows.replaceAll("'", '"'));
});
const dark = [16, 20, 27], lime = [206, 239, 100];
const shapes = (size, unit) => glyphs.flatMap((rows, letter) => rows.flatMap((row, y) =>
  [...row].flatMap((pixel, x) => pixel === '1' ? [{
    x: (size - 11 * unit) / 2 + (letter * 6 + x) * unit,
    y: (size - 7 * unit) / 2 + y * unit, width: unit, height: unit, color: dark
  }] : [])));
const hex = rgb => '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
const svgRects = rects => rects.map(r => `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${hex(r.color)}"/>`).join('');

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
function png(size, background, rectangles) {
  const stride = size * 3 + 1, scanlines = Buffer.alloc(stride * size);
  const row = Buffer.alloc(size * 3).fill(Buffer.from(background));
  for (let y = 0; y < size; y++) row.copy(scanlines, y * stride + 1);
  for (const rect of rectangles) {
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      scanlines.fill(Buffer.from(rect.color), y * stride + 1 + rect.x * 3,
        y * stride + 1 + (rect.x + rect.width) * 3);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size); header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = 2; // 8-bit RGB: opaque, with no alpha channel.
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const brand = new URL('mobile/brand/', root);
await mkdir(brand, { recursive: true });
const icon = png(1024, lime, shapes(1024, 64));
await writeFile(new URL('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', root), icon);
await writeFile(new URL('app-icon.svg', brand), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${hex(lime)}"/>${svgRects(shapes(1024, 64))}</svg>\n`);

const size = 2732, panel = 384, radius = 76, start = (size - panel) / 2;
const roundedPanel = Array.from({ length: panel }, (_, y) => {
  const fromEdge = Math.min(y + 0.5, panel - y - 0.5);
  const inset = fromEdge < radius ? Math.ceil(radius - Math.sqrt(radius ** 2 - (radius - fromEdge) ** 2)) : 0;
  return { x: start + inset, y: start + y, width: panel - 2 * inset, height: 1, color: lime };
});
const launch = png(size, dark, [...roundedPanel, ...shapes(size, 24)]);
for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'])
  await writeFile(new URL(`ios/App/App/Assets.xcassets/Splash.imageset/${name}`, root), launch);
await writeFile(new URL('launch.svg', brand), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${hex(dark)}"/><rect x="${start}" y="${start}" width="${panel}" height="${panel}" rx="${radius}" fill="${hex(lime)}"/>${svgRects(shapes(size, 24))}</svg>\n`);
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
await writeFile(new URL('provenance.json', brand), JSON.stringify({
  source: 'dist/market-raster.js: F and X glyphs', generator: 'scripts/build-ios-brand.mjs',
  colors: { dark: hex(dark), lime: hex(lime) }, externalImagesOrFonts: false,
  icon: { size: 1024, format: 'RGB PNG', sha256: sha256(icon) },
  launch: { size, format: 'RGB PNG', sha256: sha256(launch) }
}, null, 2) + '\n');

const preview = process.argv.indexOf('--preview');
if (preview !== -1) await writeFile(process.argv[preview + 1], png(256, lime, shapes(256, 16)));
console.log(`iPhone icon and launch artwork generated in ${fileURLToPath(brand)}`);
