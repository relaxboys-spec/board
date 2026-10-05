import type { EmoteId } from './types';

type Side = 'l' | 'r';

/**
 * Nova's 20 emotes (design/quest-board/AVATAR.md §5; animations in emotes.css).
 * `front`: arms brought in front of the body for this emote (hands at the chest);
 * `face`: arms brought in front of the face too (salute, dab).
 */
export const EMOTES: { id: EmoteId; name: string; ms: number; front?: Side[]; face?: Side[] }[] = [
  { id: 'victory', name: 'Victory', ms: 1500 }, { id: 'thumkas', name: 'Thumkas', ms: 3000 },
  { id: 'wave', name: 'Wave', ms: 2000 }, { id: 'dab', name: 'Dab', ms: 1600, face: ['l'] },
  { id: 'floss', name: 'Floss', ms: 2400, front: ['l', 'r'] }, { id: 'clap', name: 'Clap', ms: 2000, front: ['l', 'r'] },
  { id: 'spin', name: 'Spin', ms: 1400 }, { id: 'jacks', name: 'Jumping Jacks', ms: 2400 },
  { id: 'salute', name: 'Salute', ms: 2000, face: ['r'] }, { id: 'namaste', name: 'Namaste', ms: 2200, front: ['l', 'r'] },
  { id: 'bhangra', name: 'Bhangra', ms: 2400 }, { id: 'shrug', name: 'Shrug', ms: 1600 },
  { id: 'laugh', name: 'Laugh', ms: 2000, front: ['l', 'r'] }, { id: 'flex', name: 'Flex', ms: 2000 },
  { id: 'heart', name: 'Heart Hands', ms: 2200 }, { id: 'headbang', name: 'Headbang', ms: 2000, front: ['l'] },
  { id: 'disco', name: 'Disco', ms: 2400, front: ['r'] }, { id: 'robot', name: 'Robot', ms: 2400, front: ['l', 'r'] },
  { id: 'garba', name: 'Garba', ms: 2800, front: ['l', 'r'] }, { id: 'bow', name: 'Bow', ms: 2000, front: ['l'] },
];

export function emoteById(id: EmoteId) {
  return EMOTES.find((e) => e.id === id) ?? EMOTES[0];
}

const timers = new WeakMap<HTMLElement, number[]>();
const homes = new WeakMap<Element, { parent: Node; next: Node | null }>();

/** Put moved arms back where the drawing has them (behind the torso). */
function armsHome(wrapper: HTMLElement) {
  for (const side of ['r', 'l']) {
    const arm = wrapper.querySelector('.av-arm-' + side);
    const home = arm && homes.get(arm);
    if (arm && home && (arm.parentNode !== home.parent || arm.nextSibling !== home.next)) home.parent.insertBefore(arm, home.next);
  }
}

/** Bring arms in front of the torso (just under the head) or in front of the face too. */
function armsForward(wrapper: HTMLElement, front: Side[] = [], face: Side[] = []) {
  const head = wrapper.querySelector('.av-head');
  for (const side of ['l', 'r'] as Side[]) {
    const arm = wrapper.querySelector('.av-arm-' + side);
    if (!arm || !arm.parentNode || !head) continue;
    if (!homes.has(arm)) homes.set(arm, { parent: arm.parentNode, next: arm.nextSibling });
    // The head sits in its own wrapper group, a sibling of the arms.
    let headTop: Element = head;
    while (headTop.parentNode && headTop.parentNode !== arm.parentNode) headTop = headTop.parentNode as Element;
    if (headTop.parentNode !== arm.parentNode) continue;
    if (face.includes(side)) arm.parentNode.appendChild(arm);
    else if (front.includes(side)) arm.parentNode.insertBefore(arm, headTop);
  }
}

/**
 * Play an emote on Nova's wrapper: clear the class, set em-<id> ~30 ms later (so a
 * repeat restarts), then return to av-idle after the duration + 200 ms.
 */
export function playEmote(wrapper: HTMLElement, id: EmoteId, onEnd?: () => void) {
  for (const t of timers.get(wrapper) ?? []) clearTimeout(t);
  const cls = [...wrapper.classList].filter((c) => c.startsWith('em-') || c.startsWith('av-'));
  wrapper.classList.remove(...cls);
  armsHome(wrapper);
  const e = emoteById(id);
  const t1 = window.setTimeout(() => {
    armsForward(wrapper, e.front, e.face);
    wrapper.classList.add('em-' + e.id);
  }, 30);
  const t2 = window.setTimeout(() => {
    wrapper.classList.remove('em-' + e.id);
    armsHome(wrapper);
    wrapper.classList.add('av-idle');
    onEnd?.();
  }, 30 + e.ms + 200);
  timers.set(wrapper, [t1, t2]);
}
