import { setReminder } from '../actions';
import { store } from '../store';
import { button, el, isoWithOffset, toLocalInput } from '../util';
import { openSheet, toast } from './overlay';

const SHORTCUT_NAME = 'Board Reminder';

/** Default due time: the next whole hour today if it's before 8pm, else 9am tomorrow. */
function defaultDue(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  if (d.getHours() >= 20 || d.getHours() < 7) {
    if (d.getHours() >= 20) d.setDate(d.getDate() + 1);
    d.setHours(9);
  }
  return d;
}

function firstWords(text: string, n: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const out = words.slice(0, n).join(' ');
  return words.length > n ? out + '…' : out;
}

export function shortcutUrl(label: string, dueIso: string): string {
  const payload = JSON.stringify({ label, due: dueIso });
  return `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}&input=text&text=${encodeURIComponent(payload)}`;
}

/** Open the Shortcuts app via an anchor click (reliable from a home-screen app). */
function launch(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
}

export function openReminderSheet(noteId: string) {
  const note = store.get(noteId);
  if (!note) return;
  const sheet = openSheet(note.reminder ? 'Change reminder' : 'Remind me');

  const when = el('input');
  when.type = 'datetime-local';
  when.className = 'field';
  when.value = toLocalInput(note.reminder ? new Date(note.reminder.due) : defaultDue());

  const label = el('input');
  label.type = 'text';
  label.className = 'field';
  label.maxLength = 120;
  label.placeholder = 'Write a short label…';
  label.autocomplete = 'off';
  // Prefill from the note's text (e.g. a dictated note) when there's no label yet.
  label.value = note.reminder?.label || firstWords(note.text ?? '', 6);

  const whenWrap = el('label', 'field-wrap');
  whenWrap.append(el('span', 'field-label', 'When'), when);
  const labelWrap = el('label', 'field-wrap');
  labelWrap.append(el('span', 'field-label', 'Label (handwrite with Scribble)'), label);

  const hint = el(
    'p',
    'hint',
    `Saving opens the Shortcuts app and runs “${SHORTCUT_NAME}”, which adds it to Reminders with an alert. Set the Shortcut up once using SHORTCUT_SETUP.md.`,
  );

  const actions = el('div', 'sheet-actions');
  if (note.reminder) {
    actions.append(
      button('btn ghost', 'Remove', () => {
        setReminder(noteId, undefined);
        sheet.close();
        toast('Reminder removed from the note (delete it in Reminders too)');
      }),
    );
  }
  actions.append(
    button('btn primary', 'Save reminder', () => {
      const d = new Date(when.value);
      if (!when.value || Number.isNaN(d.getTime())) {
        when.focus();
        return;
      }
      const reminder = { label: label.value.trim() || 'Sticky note', due: isoWithOffset(d) };
      setReminder(noteId, reminder);
      sheet.close();
      launch(shortcutUrl(reminder.label, reminder.due));
    }),
  );

  sheet.body.append(whenWrap, labelWrap, hint, actions);
}
