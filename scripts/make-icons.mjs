// Generates the app icons (original artwork) as PNGs with no dependencies:
// a white task card with a checked status circle and a line of handwriting, on a soft
// indigo ground (the default accent). Run: npm run icons
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../public/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const TOP = hex('#7476F2');
const BOTTOM = hex('#4B4CC9');
const CARD = hex('#FFFFFF');
const ACCENT = hex('#5B5BD6');
const INK = hex('#2A2F45');
const WHITE = [255, 255, 255];

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (v) => Math.min(Math.max(v, 0), 1);

function sdRoundRect(px, py, hw, hh, r) {
  const qx = Math.abs(px) - hw + r;
  const qy = Math.abs(py) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
  const h = clamp01((pax * bax + pay * bay) / (bax * bax + bay * bay));
  return Math.hypot(pax - bax * h, pay - bay * h);
}

function polyDist(px, py, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, sdSegment(px, py, ...pts[i], ...pts[i + 1]));
  return d;
}

// In card-local units (the card spans about -0.3..0.3).
const CHECK = [[-0.165, -0.09], [-0.135, -0.06], [-0.085, -0.125]];
const line = (y, x0, x1, amp, waves) =>
  Array.from({ length: 40 }, (_, i) => {
    const t = i / 39;
    return [x0 + t * (x1 - x0), y + Math.sin(t * Math.PI * waves) * amp];
  });
const HAND1 = line(0.06, -0.19, 0.19, 0.014, 11);
const HAND2 = line(0.15, -0.19, 0.04, 0.014, 7);

/** Colour at normalised icon coords (u, v in 0..1). `k` scales the artwork (maskable safe zone). */
function shade(u, v, k) {
  let c = mix(TOP, BOTTOM, v);
  c = mix(c, WHITE, clamp01(1 - Math.hypot(u - 0.2, v - 0.1) / 0.7) * 0.12);

  const ang = (-6 * Math.PI) / 180;
  const cx = (u - 0.5) / k, cy = (v - 0.51) / k;
  const rx = cx * Math.cos(ang) - cy * Math.sin(ang);
  const ry = cx * Math.sin(ang) + cy * Math.cos(ang);

  // soft shadow, then the card
  const dShadow = sdRoundRect(rx, ry - 0.025, 0.3, 0.3, 0.075);
  if (dShadow < 0.05) c = mix(c, [20, 20, 60], clamp01(1 - (dShadow + 0.05) / 0.1) * 0.35);
  const d = sdRoundRect(rx, ry, 0.3, 0.3, 0.075);
  if (d < 0) {
    c = CARD;
    // the checked status circle
    const dc = Math.hypot(rx + 0.125, ry + 0.095) - 0.075;
    if (dc < 0) c = polyDist(rx, ry, CHECK) < 0.016 ? WHITE : ACCENT;
    // a line and a half of handwriting
    else if (polyDist(rx, ry, HAND1) < 0.013 || polyDist(rx, ry, HAND2) < 0.013) c = INK;
  }
  return c;
}

function render(size, k) {
  const SS = 4;
  const rgb = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let j = 0; j < SS; j++) {
        for (let i = 0; i < SS; i++) {
          const c = shade((x + (i + 0.5) / SS) / size, (y + (j + 0.5) / SS) / size, k);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const o = (y * size + x) * 3;
      const n = SS * SS;
      rgb[o] = Math.round(r / n);
      rgb[o + 1] = Math.round(g / n);
      rgb[o + 2] = Math.round(b / n);
    }
  }
  return png(size, size, rgb);
}

// ---- minimal PNG encoder (RGB, 8-bit) ----
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const jobs = [
  ['apple-touch-icon.png', 180, 1],
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['icon-maskable-512.png', 512, 0.78],
];
for (const [name, size, k] of jobs) {
  writeFileSync(new URL(name, OUT), render(size, k));
  console.log('wrote', name);
}
