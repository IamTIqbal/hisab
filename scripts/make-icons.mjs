// Renders the PNG app icons from the logo in public/icons/icon.svg.
// The SVG is the source of truth and is never modified here.
// Run: npm run icons
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const logo = await readFile('public/icons/icon.svg', 'utf8');

// Maskable icons are cropped to a circle or squircle by Android, so they need
// a full-bleed square: same artwork, without the rounded corners.
const fullBleed = logo.replace(/\s+rx="[^"]*"/, '');

const render = (svg, size, out) =>
  sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toFile(out);

await render(logo, 192, 'public/icons/icon-192.png');
await render(logo, 512, 'public/icons/icon-512.png');
await render(fullBleed, 512, 'public/icons/maskable-512.png');
await render(fullBleed, 180, 'public/icons/apple-touch-icon.png');
console.log('icons written from public/icons/icon.svg');
