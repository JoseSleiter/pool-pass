#!/usr/bin/env node
/**
 * Regenerates every brand asset from the source photograph of the physical sign.
 *
 *   node scripts/build-brand-assets.mjs
 *
 * The source is a photo, not a vector file: the logo sits on a marble pedestal
 * against a flat #F7F7F7 backdrop. The backdrop comes off with a flood fill
 * from the borders; the pedestal is keyed out of the bottom strip by colour.
 * See docs/superpowers/specs/2026-08-31-brand-identity-design.md for why the
 * cutout is done this way and what it costs.
 */
import sharp from 'sharp';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'assets/brand-source/logo-cartel.jpg');

/** Backdrop colour of the source photo, sampled at all four corners. */
const BACKDROP = [247, 247, 247];
const BACKDROP_TOLERANCE = 30;

/** Row where the marble pedestal starts. Above it there is nothing to key. */
const PEDESTAL_TOP = 615;

/**
 * Window over the sun + figures + waves cluster, in source coordinates.
 * The full lockup is ~1.7:1, so at favicon sizes its wordmark is unreadable.
 * This cluster is the part of the logo that still reads at 32px.
 */
const MARK_WINDOW = { left: 988, top: 292, width: 327, height: 505 };

/** Width of the logo embedded in the voucher email, in px. Keep it modest:
 *  the PNG ships base64-encoded inside a TypeScript module. */
const EMAIL_LOGO_WIDTH = 360;

async function cutout() {
  const { data, info } = await sharp(SOURCE)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const count = width * height;
  const opaque = new Uint8Array(count).fill(1);

  const isBackdrop = (i) =>
    Math.abs(data[i] - BACKDROP[0]) <= BACKDROP_TOLERANCE &&
    Math.abs(data[i + 1] - BACKDROP[1]) <= BACKDROP_TOLERANCE &&
    Math.abs(data[i + 2] - BACKDROP[2]) <= BACKDROP_TOLERANCE;

  // 1. Flood fill inward from every border pixel. Only backdrop that is
  //    connected to an edge goes, so light areas enclosed by the logo survive.
  const queue = [];
  const seen = new Uint8Array(count);
  for (let x = 0; x < width; x++) queue.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) queue.push(y * width, y * width + width - 1);
  while (queue.length) {
    const p = queue.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    if (!isBackdrop(p * channels)) continue;
    opaque[p] = 0;
    const x = p % width;
    const y = (p / width) | 0;
    if (x > 0) queue.push(p - 1);
    if (x < width - 1) queue.push(p + 1);
    if (y > 0) queue.push(p - width);
    if (y < height - 1) queue.push(p + width);
  }

  // 2. Key the marble out of the bottom strip. Marble is warm (r >= b) and
  //    desaturated; every logo element down there is either saturated (the
  //    greens, the purple) or cool (the blue wave, the teal figure).
  for (let y = PEDESTAL_TOP; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!opaque[p]) continue;
      const i = p * channels;
      const chroma =
        Math.max(data[i], data[i + 1], data[i + 2]) -
        Math.min(data[i], data[i + 1], data[i + 2]);
      if (chroma < 77 && data[i] >= data[i + 2] - 5) opaque[p] = 0;
    }
  }

  for (let p = 0; p < count; p++) data[p * channels + 3] = opaque[p] ? 255 : 0;
  return { data, width, height, channels };
}

/** A fresh sharp pipeline over the cutout. Pipelines are single-use. */
function pipeline(cut) {
  const { data, width, height, channels } = cut;
  return sharp(Buffer.from(data), { raw: { width, height, channels } });
}

/** Tight bounding box of the non-transparent pixels. */
function bounds({ data, width, height, channels }) {
  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + 3] === 0) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** Centres a region inside a transparent square. */
function squarePadding(window) {
  const side = Math.max(window.width, window.height) + 40;
  const left = Math.round((side - window.width) / 2);
  const top = Math.round((side - window.height) / 2);
  return {
    top,
    left,
    bottom: side - window.height - top,
    right: side - window.width - left,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  };
}

async function main() {
  const cut = await cutout();
  const box = bounds(cut);
  await mkdir(path.join(ROOT, 'public/brand'), { recursive: true });

  // Full lockup, trimmed to its own bounds.
  const lockup = await pipeline(cut)
    .extract(box)
    .resize({ width: 1240 })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });
  await writeFile(path.join(ROOT, 'public/brand/logo.png'), lockup.data);

  // Square mark, transparent.
  const markPng = await pipeline(cut)
    .extract(MARK_WINDOW)
    .extend(squarePadding(MARK_WINDOW))
    .png()
    .toBuffer();
  await sharp(markPng)
    .resize(512, 512)
    .png({ compressionLevel: 9 })
    .toFile(path.join(ROOT, 'public/brand/logo-mark.png'));

  // App icons: the mark on white. Next serves src/app/icon.png automatically.
  for (const [file, size] of [
    ['public/icon-192.png', 192],
    ['public/icon-512.png', 512],
    ['src/app/icon.png', 512],
  ]) {
    await sharp(markPng)
      .resize(size, size, { fit: 'contain', background: '#ffffff' })
      .flatten({ background: '#ffffff' })
      .png({ compressionLevel: 9 })
      .toFile(path.join(ROOT, file));
  }

  // Email logo, flattened on white: some older clients paint PNG transparency
  // black. Ships as base64 inside a module because public/ is not reliably
  // present in a Vercel serverless bundle.
  const emailLogo = await pipeline(cut)
    .extract(box)
    .resize({ width: EMAIL_LOGO_WIDTH })
    .flatten({ background: '#ffffff' })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  await writeFile(
    path.join(ROOT, 'src/lib/email/logo-data.ts'),
    '// Generated by scripts/build-brand-assets.mjs — do not edit by hand.\n' +
      '// Attached to the voucher email as a cid: image.\n' +
      `export const LOGO_PNG_BASE64 =\n  '${emailLogo.toString('base64')}';\n`
  );

  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  console.log(`logo.png          ${lockup.info.width}x${lockup.info.height}  ${kb(lockup.data.length)}`);
  console.log(`logo-mark.png     512x512`);
  console.log(`email logo        ${EMAIL_LOGO_WIDTH}px wide, ${kb(emailLogo.length)} raw / ${kb(emailLogo.toString('base64').length)} base64`);
  console.log(`\nPut these dimensions in src/components/brand/logo.tsx:`);
  console.log(`  LOGO_WIDTH = ${lockup.info.width}, LOGO_HEIGHT = ${lockup.info.height}`);
  for (const f of ['public/icon-192.png', 'public/icon-512.png', 'src/app/icon.png']) {
    console.log(`${f.padEnd(18)}${kb((await stat(path.join(ROOT, f))).size)}`);
  }
}

main();
