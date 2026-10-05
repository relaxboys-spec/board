import { avatarSvg, lookFor } from '../avatar';
import { playEmote } from '../emotes';
import { DEFAULT_PLAYER, type Look } from '../types';
import { el, prefersReducedMotion } from '../util';

/**
 * The sign-in screen. She signs in once per device; after that the app opens straight
 * to the board until she signs out (Settings).
 *
 * This is a front door, not a vault: the app has no server, so the check runs here, and
 * anyone determined could get past it. Notes never leave the device either way. Only a
 * hash of "username:pin" is in the source, so the actual values don't appear in the
 * (public) repo — make a new one with `node scripts/login-hash.mjs <username> <pin>`.
 */

const PASS = '1n994ptvta6';
const SEED = 0x51b0a4d;
const KEY = 'qb-signin';

/** cyrb53 — a small, fast string hash (not cryptographic). Same as scripts/login-hash.mjs. */
function hash(str: string, seed = SEED): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function signedIn(): boolean {
  try {
    return localStorage.getItem(KEY) === PASS;
  } catch {
    return false;
  }
}

export function signOut() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: nothing to forget */
  }
  location.reload();
}

let open = false;
export function loginOpen() {
  return open;
}

const PLAY =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="#0A1430" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>';

/** Show the sign-in screen over the app. `setLook` swaps in her saved Nova once data loads. */
export function showLogin(onSignedIn: () => void): { setLook(look: Look): void } {
  open = true;
  const root = el('div', 'qb-login');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Sign in');

  // Left: Nova on her stand under the title
  const stage = el('div', 'qb-login-stage');
  const title = el('div', 'qb-login-title');
  title.append(el('span', 'qb-display qb-login-logo', 'Quest Board'));
  const fig = el('div', 'qb-login-fig av-idle');
  fig.innerHTML = avatarSvg(lookFor({ ...DEFAULT_PLAYER }), { width: 230 });
  const podium = el('div', 'qb-login-podium');
  podium.append(el('div', 'qb-beam'), el('div', 'qb-pedestal'), fig);
  stage.append(title, podium);

  // Right: the form
  const form = el('form', 'qb-login-card');
  form.noValidate = true;
  form.setAttribute('autocomplete', 'on');
  const head = el('div', 'qb-login-head');
  head.append(el('span', 'qb-eyebrow', 'Ready up'), el('h1', 'qb-display qb-login-h', 'Welcome back'));

  const userLabel = el('label', 'qb-login-field');
  const user = el('input', 'qb-login-input');
  user.type = 'text';
  user.name = 'username';
  user.autocomplete = 'username';
  user.setAttribute('autocapitalize', 'none');
  user.setAttribute('autocorrect', 'off');
  user.spellcheck = false;
  user.placeholder = 'Your name';
  userLabel.append(el('span', 'qb-login-label', 'Username'), user);

  const pinLabel = el('label', 'qb-login-field');
  const pinBox = el('div', 'qb-pincode');
  const cells = [0, 1, 2, 3].map(() => el('span', 'qb-pincode-cell'));
  const pin = el('input', 'qb-pincode-input');
  pin.type = 'password';
  pin.name = 'password';
  pin.autocomplete = 'current-password';
  pin.inputMode = 'numeric';
  pin.pattern = '[0-9]*';
  pin.maxLength = 4;
  pin.setAttribute('aria-label', 'PIN');
  pinBox.append(...cells, pin);
  pinLabel.append(el('span', 'qb-login-label', 'PIN'), pinBox);

  const err = el('p', 'qb-login-err');
  err.setAttribute('aria-live', 'polite');
  const go = el('button', 'qb-skew8 qb-cta qb-login-go');
  go.type = 'submit';
  go.innerHTML = `<span>${PLAY}Play</span>`;
  form.append(head, userLabel, pinLabel, err, go, el('p', 'qb-login-hint', 'You’ll stay signed in on this iPad.'));

  root.append(el('div', 'qb-login-stripes'), stage, form);
  document.body.append(root);

  const paint = () => {
    const v = pin.value.replace(/\D/g, '').slice(0, 4);
    if (v !== pin.value) pin.value = v;
    cells.forEach((c, i) => {
      c.classList.toggle('filled', i < v.length);
      c.classList.toggle('current', document.activeElement === pin && i === Math.min(v.length, 3));
    });
  };
  pin.addEventListener('input', () => {
    err.textContent = '';
    paint();
    if (pin.value.length === 4 && user.value.trim()) submit();
  });
  pin.addEventListener('focus', paint);
  pin.addEventListener('blur', paint);
  user.addEventListener('input', () => (err.textContent = ''));
  user.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      pin.focus();
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit();
  });

  let done = false;
  function submit() {
    if (done) return;
    if (!user.value.trim()) {
      err.textContent = 'Enter your username';
      user.focus();
      return;
    }
    if (pin.value.length < 4) {
      err.textContent = 'Enter your 4-digit PIN';
      pin.focus();
      return;
    }
    if (hash(`${user.value.trim().toLowerCase()}:${pin.value}`) !== PASS) {
      err.textContent = 'Not quite — try again';
      pin.value = '';
      paint();
      form.classList.remove('shake');
      void form.offsetWidth;
      form.classList.add('shake');
      pin.focus();
      return;
    }
    done = true;
    try {
      localStorage.setItem(KEY, PASS);
    } catch {
      /* private mode: she'll be asked again next time */
    }
    user.blur();
    pin.blur();
    root.classList.add('success');
    head.replaceChildren(el('span', 'qb-eyebrow', 'Signed in'), el('h1', 'qb-display qb-login-h', 'Let’s go!'));
    const finish = () => {
      root.classList.add('leaving');
      window.setTimeout(() => {
        root.remove();
        open = false;
        onSignedIn();
      }, 350);
    };
    if (prefersReducedMotion()) finish();
    else playEmote(fig, 'victory', finish);
  }

  // Say hello, then focus the first empty field (opens the keyboard where iPadOS allows it).
  if (!prefersReducedMotion()) window.setTimeout(() => !done && playEmote(fig, 'wave'), 500);
  window.setTimeout(() => (user.value ? pin : user).focus(), 60);

  return {
    setLook(look: Look) {
      if (!done) fig.innerHTML = avatarSvg(look, { width: 230 });
    },
  };
}
