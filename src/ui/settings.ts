import { formatBytes, parseBackup, prepareBackup, saveBackupFile, type ImportSummary } from '../backup';
import { signOut } from './login';
import { imageUsage } from '../db';
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
  const storeTitle = el('h3', 'setting-title', 'Where your notes live');
  const warn = el(
    'p',
    'warning',
    'Everything is stored only on this iPad, inside this app. Nothing is ever sent anywhere. ' +
      'Removing Quest Board from the Home Screen deletes all of its notes — export a backup first.',
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
    `Quest Board ${__APP_VERSION__} · Fonts: Barlow, Barlow Condensed © The Barlow Project Authors — SIL Open Font License 1.1`,
  );

  // Account
  const accountTitle = el('h3', 'setting-title', 'Account');
  const accountRow = el('div', 'sheet-actions left');
  accountRow.append(button('btn', 'Sign out', () => signOut()));
  const accountHint = el('p', 'hint', 'Signed in on this iPad. Signing out keeps all notes; you’ll need your username and PIN to get back in.');

  b.append(soundRow, backupTitle, lastEl, actions, storeTitle, warn, usageEl, persistEl, accountTitle, accountHint, accountRow, about);
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
