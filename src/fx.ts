import { prefersReducedMotion } from './util';

/** Victory burst + "+XP" pop. With reduced motion: no particles, just a gentle fade of the label. */

const COLORS = ['#ffd23f', '#ff5d8f', '#3ddc84', '#4cc9ff', '#a970ff', '#ff8a3d', '#ffffff'];

let layer: HTMLDivElement | null = null;

function fxLayer(): HTMLDivElement {
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'fx-layer';
    document.body.append(layer);
  }
  return layer;
}

export function xpPop(x: number, y: number, text: string, cls = '') {
  const e = document.createElement('div');
  e.className = `xp-pop ${cls}`;
  e.textContent = text;
  e.style.left = x + 'px';
  e.style.top = y + 'px';
  fxLayer().append(e);
  e.addEventListener('animationend', () => e.remove(), { once: true });
  window.setTimeout(() => e.remove(), 2000);
}

export function burst(x: number, y: number, power = 1) {
  if (prefersReducedMotion()) return;
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.className = 'fx-canvas';
  fxLayer().append(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  const n = Math.round(70 * power);
  const parts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const sp = 4 + Math.random() * 9 * power;
    return {
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 5,
      w: 6 + Math.random() * 8,
      h: 4 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.5,
      c: COLORS[i % COLORS.length],
      star: i % 5 === 0,
    };
  });

  // Ring flash
  const start = performance.now();
  const DURATION = 1100;
  const frame = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, W, H);
    if (t < 260) {
      const k = t / 260;
      ctx.beginPath();
      ctx.arc(x, y, 30 + k * 130 * power, 0, Math.PI * 2);
      ctx.lineWidth = 14 * (1 - k);
      ctx.strokeStyle = `rgba(255,255,255,${1 - k})`;
      ctx.stroke();
    }
    const fade = Math.min(1, Math.max(0, (DURATION - t) / 300));
    for (const p of parts) {
      p.vy += 0.38;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      if (p.star) drawStar(ctx, p.w * 0.8);
      else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (t < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

function drawStar(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.45 : r;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
}
