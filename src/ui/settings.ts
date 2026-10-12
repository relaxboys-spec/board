import { formatBytes, parseBackup, prepareBackup, saveBackupFile, type ImportSummary } from '../backup';
import { signOut } from './login';
import { deleteImages, getImage, imageUsage } from '../db';
import { acquireUrl, processImage, releaseUrl, saveImage } from '../images';
import { ACCENTS, APPEARANCES, reloadCustomWallpaper, WALLPAPER_IMAGE_ID, WALLPAPERS, type Appearance } from '../theme';
import { store } from '../store';
import { button, el } from '../util';
import { openSheet, toast } from './overlay';

/**
 * Export: gather the backup (photos included), show its size, then save from a second
 * tap — the share sheet needs a fresh user gesture, and the gathering is async.
 */
export async function runExport(onDone: () => void = () => {}) {
  toast('Preparing backup…', undefined, 1500);
  let prepared;
  try {
    prepared = await prepareBackup();
  } catch (err) {
    toast('Couldn’t prepare the backup: ' + (err as Error).message, undefined, 5000);
    return;
  }
  const sheet = openSheet('Backup ready');
  const p = prepared;
  const list = el('ul', 'summary');
  list.append(
    el('li', '', `Size: ${formatBytes(p.bytes)}`),
    el('li', '', `${p.notes} note${p.notes === 1 ? '' : 's'}, ${p.photos} photo${p.photos === 1 ? '' : 's'}`),
  );
  const hint = el('p', 'hint', 'Choose “Save to Files” in the share sheet to keep it somewhere safe (iCloud Drive works well).');
  const actions = el('div', 'sheet-actions');
  actions.append(
    button('btn ghost', 'Cancel', () => sheet.close()),
    button('btn primary', 'Save backup', () => {
      // navigator.share is called synchronously inside this tap.
      void saveBackupFile(p.file).then((result) => {
        if (result === 'cancelled') return;
        sheet.close();
        toast(result === 'shared' ? 'Backup saved' : 'Backup downloaded');
        onDone();
      });
    }),
  );
  sheet.body.append(list, hint, actions);
}

export function openSettings(onImported: () => void) {
  const sheet = openSheet('Settings');
  const b = sheet.body;
  const look = el('section', 'qb-settings-look');
  renderAppearance(look);
  const unsub = store.on((e) => e.type === 'settings' && renderAppearance(look));
  new MutationObserver((_, obs) => {
    if (!sheet.el.isConnected) {
      unsub();
      obs.disconnect();
    }
  }).observe(document.body, { childList: true, subtree: true });

  // Sound
  const soundRow = el('label', 'setting-row');
  const sound = el('input');
  sound.type = 'checkbox';
  sound.className = 'toggle';
  sound.checked = store.settings.sound;
  sound.addEventListener('change', () => store.setSettings({ sound: sound.checked }));
  soundRow.append(el('span', '', 'Sound effects'), sound);

  // Backup
  const backupTitle = el('h3', 'setting-title', 'Backup');
  const last = store.backup.lastExportAt;
  const lastText = last
    ? `Last backup: ${new Date(last).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`
    : 'No backup yet.';
  const exportBtn = button('btn primary', 'Export backup', () => {
    sheet.close();
    void runExport();
  });
  const lastEl = el('p', 'hint', lastText);

  const file = el('input');
  file.type = 'file';
  file.accept = 'application/json,.json';
  file.hidden = true;
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    try {
      const summary = parseBackup(await f.text());
      sheet.close();
      confirmImport(summary, onImported);
    } catch (err) {
      toast((err as Error).message, undefined, 5000);
    }
  });
  const importBtn = button('btn', 'Import backup…', () => file.click());

  const actions = el('div', 'sheet-actions left');
  actions.append(exportBtn, importBtn, file);

  // Storage
  const storeTitle = el('h3', 'setting-title', 'Where your tasks live');
  const warn = el(
    'p',
    'warning',
    'Everything is stored only on this iPad, inside this app. Nothing is ever sent anywhere. ' +
      'Removing Board from the Home Screen deletes all of its tasks — export a backup first.',
  );
  const usageEl = el('ul', 'summary');
  usageEl.append(el('li', '', 'Checking storage…'));
  const persistEl = el('p', 'hint', '');
  void (async () => {
    try {
      const [est, photos, persisted] = await Promise.all([
        navigator.storage?.estimate?.(),
        imageUsage(),
        navigator.storage?.persisted?.(),
      ]);
      usageEl.replaceChildren(
        el('li', '', `Total used by the app: ${est?.usage != null ? formatBytes(est.usage) : 'unknown'}`),
        el('li', '', `Photos: ${formatBytes(photos.bytes)} (${photos.count} photo${photos.count === 1 ? '' : 's'})`),
      );
      persistEl.textContent = persisted
        ? 'Storage is marked persistent.'
        : 'Storage is not marked persistent (Safari may still keep it).';
    } catch {
      usageEl.replaceChildren();
    }
  })();

  const about = el(
    'p',
    'hint small',
    `Board ${__APP_VERSION__} · Uses the iPad’s system font`,
  );

  // Account
  const accountTitle = el('h3', 'setting-title', 'Account');
  const accountRow = el('div', 'sheet-actions left');
  accountRow.append(button('btn', 'Sign out', () => signOut()));
  const accountHint = el('p', 'hint', 'Signed in on this iPad. Signing out keeps all notes; you’ll need your username and PIN to get back in.');

  b.append(look, soundRow, backupTitle, lastEl, actions, storeTitle, warn, usageEl, persistEl, accountTitle, accountHint, accountRow, about);
}

function confirmImport(s: ImportSummary, onImported: () => void) {
  const sheet = openSheet('Replace with backup?');
  const when = s.exportedAt ? new Date(s.exportedAt).toLocaleString() : 'unknown date';
  const list = el('ul', 'summary');
  list.append(
    el('li', '', `Backup from ${when}`),
    el('li', '', `Work: ${s.counts.work} notes on the board`),
    el('li', '', `Personal: ${s.counts.personal} notes on the board`),
    el('li', '', `Done jar: ${s.done} notes · ${s.xp} XP`),
    el('li', '', `Photos: ${s.images.length} (${formatBytes(s.photoBytes)})`),
  );
  const current = [...store.notes.values()].length;
  const warn = el('p', 'warning', `This replaces everything currently in the app (${current} notes). It can’t be undone.`);
  const actions = el('div', 'sheet-actions');
  actions.append(
    button('btn ghost', 'Cancel', () => sheet.close()),
    button('btn danger', 'Replace my notes', async () => {
      try {
        await store.reset(s.notes, { settings: s.settings, view: s.view, player: s.player }, s.images);
        sheet.close();
        onImported();
        toast('Backup restored');
      } catch (err) {
        toast('Import failed: ' + (err as Error).message, undefined, 5000);
      }
    }),
  );
  sheet.body.append(list, warn, actions);
}

// ---- weekly nudge -----------------------------------------------------------

const WEEK = 7 * 864e5;

export function backupBanner(parent: HTMLElement): { refresh(): void } {
  const bar = el('div', 'banner');
  bar.hidden = true;
  const text = el('span', '', 'It’s been a week — save a backup to Files?');
  const go = button('btn small primary', 'Back up', () => {
    void runExport(refresh);
  });
  const later = button('banner-x', '✕', () => {
    snoozedUntil = Date.now() + 864e5;
    refresh();
  });
  later.setAttribute('aria-label', 'Not now');
  bar.append(text, go, later);
  parent.append(bar);
  let snoozedUntil = 0;

  function refresh() {
    const since = store.backup.lastExportAt ?? store.install.firstLaunchAt;
    const due = Date.now() - since > WEEK && store.notes.size > 0 && Date.now() > snoozedUntil;
    bar.hidden = !due;
  }
  refresh();
  return { refresh };
}

// ---- appearance ------------------------------------------------------------------------

const MODE_ICON: Record<Appearance, string> = {
  light: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
  dark: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>',
  glass: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="4"/><path d="M7 10l4-3M7 15l9-7" opacity=".7"/></svg>',
};

/** Appearance, wallpaper (Glass), accent colour and the avatar celebration. Re-rendered on change. */
function renderAppearance(box: HTMLElement) {
  const st = store.settings;
  const out: HTMLElement[] = [el('h3', 'setting-title first', 'Appearance')];

  const seg = el('div', 'qb-seg');
  seg.setAttribute('role', 'radiogroup');
  seg.setAttribute('aria-label', 'Appearance');
  for (const [id, label] of APPEARANCES) {
    const on = st.appearance === id;
    const btn = button('qb-seg-btn' + (on ? ' on' : ''), '', () => store.setSettings({ appearance: id }));
    btn.innerHTML = `${MODE_ICON[id]}<span>${label}</span>`;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(on));
    seg.append(btn);
  }
  out.push(seg);

  if (st.appearance === 'glass') {
    out.push(el('span', 'setting-sub', 'Wallpaper'));
    const walls = el('div', 'qb-walls');
    for (const [id, name, css] of WALLPAPERS) {
      const on = st.wallpaper === id;
      const w = button('qb-wall' + (on ? ' on' : ''), '', () => store.setSettings({ wallpaper: id }));
      w.style.backgroundImage = css;
      w.setAttribute('aria-label', name);
      w.setAttribute('aria-pressed', String(on));
      walls.append(w);
    }
    // Her own photo, once uploaded
    const custom = button('qb-wall custom' + (st.wallpaper === 'custom' ? ' on' : ''), '', () => store.setSettings({ wallpaper: 'custom' }));
    custom.setAttribute('aria-label', 'Your photo');
    custom.hidden = true;
    void getImage(WALLPAPER_IMAGE_ID).then(async (rec) => {
      if (!rec) return;
      custom.hidden = false;
      const u = await acquireUrl(WALLPAPER_IMAGE_ID, 'thumb');
      if (u) custom.style.backgroundImage = `url("${u.url}")`;
      // Released when the settings sheet goes away.
      const obs = new MutationObserver(() => {
        if (!custom.isConnected) {
          releaseUrl(WALLPAPER_IMAGE_ID, 'thumb');
          obs.disconnect();
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    });
    walls.append(custom);

    const file = el('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.hidden = true;
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      file.value = '';
      if (!f) return;
      toast('Setting wallpaper…', undefined, 1500);
      try {
        const rec = await processImage(f);
        rec.id = WALLPAPER_IMAGE_ID;
        await saveImage(rec);
        reloadCustomWallpaper();
        store.setSettings({ appearance: 'glass', wallpaper: 'custom' });
        renderAppearance(box);
        toast('Wallpaper set');
      } catch (err) {
        toast('Couldn’t use that photo: ' + (err as Error).message, undefined, 4000);
      }
    });
    const upload = button('btn small', 'Upload photo…', () => file.click());
    const actions = el('div', 'qb-wall-actions');
    actions.append(upload, file);
    if (st.wallpaper === 'custom') {
      actions.append(
        button('btn small ghost', 'Remove photo', async () => {
          await deleteImages([WALLPAPER_IMAGE_ID]);
          store.setSettings({ wallpaper: 'dusk' });
          renderAppearance(box);
        }),
      );
    }
    out.push(walls, actions, el('p', 'hint', 'Your photo stays on this iPad. It isn’t included in backups.'));
  }

  out.push(el('span', 'setting-sub', 'Accent colour'));
  const accents = el('div', 'qb-accents');
  accents.setAttribute('role', 'radiogroup');
  accents.setAttribute('aria-label', 'Accent colour');
  for (const [id, name, deep, bright] of ACCENTS) {
    const on = st.accent === id;
    const a = button('qb-accent' + (on ? ' on' : ''), '', () => store.setSettings({ accent: id }));
    a.style.setProperty('--sw', st.appearance === 'light' ? deep : bright);
    a.setAttribute('role', 'radio');
    a.setAttribute('aria-checked', String(on));
    a.setAttribute('aria-label', name);
    a.title = name;
    accents.append(a);
  }
  out.push(accents);

  const celebrateRow = el('label', 'setting-row');
  const celebrate = el('input');
  celebrate.type = 'checkbox';
  celebrate.className = 'toggle';
  celebrate.checked = st.celebrate;
  celebrate.addEventListener('change', () => store.setSettings({ celebrate: celebrate.checked }));
  const txt = el('span', 'setting-text');
  txt.append(el('span', '', 'Celebrate with my avatar'), el('small', '', 'She pops up and dances when you complete a task'));
  celebrateRow.append(txt, celebrate);
  out.push(celebrateRow);

  box.replaceChildren(...out);
}
