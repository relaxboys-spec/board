// Generates the app icons (original artwork) as PNGs with no dependencies:
// a slanted note card with an orange priority frame and a white handwritten check,
// on the board's navy glow. Run: npm run icons
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../public/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const NAVY_TOP = hex('#0F2054');
const NAVY_BOTTOM = hex('#070E26');
const GLOW = hex('#2A5CD0');
const FRAME_A = hex('#FFB547');
const FRAME_B = hex('#D2550E');
const SURFACE = hex('#0C1840');
const DOT = hex('#22305C');
const INK = hex('#F2F6FF');
const YELLOW = hex('#FFE14D');
const CYAN = hex('#3BE0FF');
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

// Checkmark + underline squiggle, in card-local units (card spans -1..1).
const CHECK = [[-0.5, 0.0], [-0.18, 0.32], [0.52, -0.42]];
const SQUIGGLE = Array.from({ length: 24 }, (_, i) => {
  const t = i / 23;
  return [-0.55 + t * 1.1, 0.62 + Math.sin(t * Math.PI * 3) * 0.05];
});

function polyDist(px, py, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, sdSegment(px, py, ...pts[i], ...pts[i + 1]));
  return d;
}

/** Inside a square of half-size `h` with its top-right corner cut by `cut` (the design's shape). */
function sdCutRect(px, py, h, cut) {
  const dx = Math.abs(px) - h;
  const dy = Math.abs(py) - h;
  let d = Math.max(dx, dy);
  // top-right corner cut: the line x - y = 2h - cut (y grows downward, so top is -y)
  const corner = (px + -py - (2 * h - cut)) / Math.SQRT2;
  return Math.max(d, corner);
}

/** Colour at normalised icon coords (u, v in 0..1). `k` scales the artwork (maskable safe zone). */
function shade(u, v, k) {
  let c = mix(NAVY_TOP, NAVY_BOTTOM, v);
  const glow = clamp01(1 - Math.hypot((u - 0.5) * 1.2, v + 0.05) / 0.75);
  c = mix(c, GLOW, glow * 0.7);
  // faint 135° stripes
  if (((u + v) * 40) % 1 < 0.08) c = mix(c, WHITE, 0.03);

  const ang = (-8 * Math.PI) / 180;
  const cx = (u - 0.5) / k, cy = (v - 0.52) / k;
  const rx = cx * Math.cos(ang) - cy * Math.sin(ang);
  const ry = cx * Math.sin(ang) + cy * Math.cos(ang);
  const H = 0.31;

  // soft shadow under the card
  const dShadow = sdCutRect(rx - 0.012, ry - 0.03, H, 0.09);
  if (dShadow < 0.04) c = mix(c, [0, 0, 0], clamp01(1 - (dShadow + 0.04) / 0.08) * 0.45);

  const d = sdCutRect(rx, ry, H, 0.09);
  if (d < 0) {
    const inset = -d;
    if (inset < 0.035) {
      c = mix(FRAME_A, FRAME_B, clamp01((rx - ry + 0.6) / 1.2));
    } else {
      c = SURFACE;
      // dotted surface
      const gx = ((rx + 1) * 22) % 1, gy = ((ry + 1) * 22) % 1;
      if (Math.hypot(gx - 0.5, gy - 0.5) < 0.12) c = DOT;
      const lx = rx / 0.22, ly = ry / 0.22;
      if (polyDist(lx, ly, CHECK) < 0.12) c = INK;
      else if (polyDist(lx, ly, SQUIGGLE) < 0.06) c = mix(INK, CYAN, 0.35);
    }
  }

  // XP sparkle top-right, small one bottom-left
  const sx = (u - 0.83) / k, sy = (v - 0.17) / k;
  if (Math.sqrt(Math.abs(sx)) + Math.sqrt(Math.abs(sy)) < Math.sqrt(0.075)) c = YELLOW;
  const sx2 = (u - 0.17) / k, sy2 = (v - 0.85) / k;
  if (Math.sqrt(Math.abs(sx2)) + Math.sqrt(Math.abs(sy2)) < Math.sqrt(0.035)) c = CYAN;
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
