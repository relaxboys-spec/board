// Dev-only test page (npm run dev → /avatar-test.html): Nova in all 33 outfits, every emote.
import './tokens.css';
import './emotes.css';
import { avatarSvg, OUTFITS, RARITY } from './avatar';
import { EMOTES, playEmote } from './emotes';
import { DEFAULT_PLAYER } from './types';

document.body.style.cssText = 'margin:0;background:#070E26;color:#fff;font:600 14px system-ui';
const app = document.getElementById('app')!;
const bar = document.createElement('div');
bar.style.cssText = 'position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:6px;padding:12px;background:#0F2054';
const grid = document.createElement('div');
grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;padding:12px';
app.append(bar, grid);

// ?w=360&only=runner,saree — bigger figures / fewer outfits, for checking poses up close.
const params = new URLSearchParams(location.search);
const width = Number(params.get('w')) || 150;
const only = params.get('only')?.split(',');
if (width > 150) grid.style.gridTemplateColumns = `repeat(auto-fill,minmax(${width + 20}px,1fr))`;

const figures: HTMLElement[] = [];
for (const o of OUTFITS.filter((o) => !only || only.includes(o.id))) {
  const card = document.createElement('div');
  card.style.cssText = `background:${RARITY[o.rarity].grad};padding:8px;text-align:center`;
  const fig = document.createElement('div');
  fig.className = 'av-idle';
  fig.innerHTML = avatarSvg({ ...DEFAULT_PLAYER, outfit: o.id, accessories: [...DEFAULT_PLAYER.accessories] }, { width });
  figures.push(fig);
  card.append(fig, Object.assign(document.createElement('div'), { textContent: `${o.name} · ${o.cat} · Lv ${o.level}` }));
  grid.append(card);
}
for (const e of EMOTES) {
  const b = document.createElement('button');
  b.textContent = e.name;
  b.style.cssText = 'min-height:44px;padding:0 12px';
  b.onclick = () => figures.forEach((f) => playEmote(f, e.id));
  bar.append(b);
}

// Scrub: freeze every running emote at a point in its timeline (0–100%) to check poses.
const scrub = Object.assign(document.createElement('input'), { type: 'range', min: '0', max: '100', value: '0' });
scrub.style.cssText = 'flex:1;min-width:200px';
scrub.oninput = () => pose(Number(scrub.value) / 100);
const label = Object.assign(document.createElement('label'), { textContent: 'Scrub ' });
label.style.cssText = 'display:flex;align-items:center;gap:8px;flex-basis:100%';
label.append(scrub);
bar.append(label);

function pose(frac: number) {
  for (const f of figures) {
    for (const a of f.getAnimations({ subtree: true })) {
      if (!(a instanceof CSSAnimation) || !a.animationName.startsWith('em')) continue;
      const end = Number(a.effect?.getComputedTiming().endTime ?? 0);
      a.pause();
      a.currentTime = Math.min(end - 1, end * frac);
    }
  }
}
(window as unknown as { __pose: typeof pose }).__pose = pose;
// Testing hook: play different emotes on different figures, e.g. __each([['dab', 0.5], ['salute', 0.5]]).
(window as unknown as { __each: (list: [string, number][]) => Promise<void> }).__each = async (list) => {
  list.forEach(([id], i) => figures[i] && playEmote(figures[i], id as (typeof EMOTES)[number]['id']));
  await new Promise((r) => setTimeout(r, 80));
  list.forEach(([, frac], i) => {
    for (const a of figures[i]?.getAnimations({ subtree: true }) ?? []) {
      if (!(a instanceof CSSAnimation) || !a.animationName.startsWith('em')) continue;
      const end = Number(a.effect?.getComputedTiming().endTime ?? 0);
      a.pause();
      a.currentTime = Math.min(end - 1, end * frac);
    }
  });
};
