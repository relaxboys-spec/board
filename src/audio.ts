/** Tiny synthesized sound effects (Web Audio only, no files). Off unless enabled in settings. */

export type SoundName = 'pop' | 'pickup' | 'drop' | 'undo' | 'done' | 'level';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(
  ac: AudioContext,
  freq: number,
  start: number,
  dur: number,
  opts: { type?: OscillatorType; gain?: number; slideTo?: number } = {},
) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = opts.type ?? 'triangle';
  osc.frequency.setValueAtTime(freq, start);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, start + dur);
  const peak = opts.gain ?? 0.18;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

export function play(name: SoundName) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.005;
  switch (name) {
    case 'pop':
      tone(ac, 520, t, 0.09, { slideTo: 880, gain: 0.14 });
      break;
    case 'pickup':
      tone(ac, 660, t, 0.06, { type: 'sine', gain: 0.1 });
      break;
    case 'drop':
      tone(ac, 240, t, 0.1, { slideTo: 150, gain: 0.16 });
      break;
    case 'undo':
      tone(ac, 700, t, 0.12, { type: 'sine', slideTo: 350, gain: 0.1 });
      break;
    case 'done':
      [523, 659, 784, 1047].forEach((f, i) => tone(ac, f, t + i * 0.07, 0.16, { gain: 0.14 }));
      break;
    case 'level':
      [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(ac, f, t + i * 0.08, 0.22, { type: 'square', gain: 0.06 }));
      break;
  }
}
