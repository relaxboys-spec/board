import { store } from './store';
import {
  PRIORITY,
  type BoardId,
  type Note,
  type Priority,
  type Reminder,
  type Stroke,
  type Weekday,
  type ZoneId,
} from './types';
import { dayKey, uid } from './util';
import { dayStart, daysBetween, nextDateFor, weekdayInWeekOf } from './days';

/** All note mutations go through here so each is one undoable step. */

export function hasText(n: Pick<Note, 'text'>): boolean {
  return !!n.text && n.text.trim().length > 0;
}

/** No ink, no text, no photos. */
export function isEmpty(n: Note | undefined): boolean {
  return !!n && n.strokes.length === 0 && !hasText(n) && !n.imageIds?.length;
}

/** Notes in a column, in order: active ones plus those completed today (they stay stamped until the reset). */
export function columnNotes(board: BoardId, zone: ZoneId, now = Date.now()): Note[] {
  const today = dayKey(now);
  const out: Note[] = [];
  for (const n of store.notes.values()) {
    if (n.board !== board || n.zone !== zone) continue;
    if (n.status === 'active' || (n.completedAt && dayKey(n.completedAt) === today)) out.push(n);
  }
  return out.sort((a, b) => a.z - b.z);
}

/** New notes go to the front of their column, right after the + New Task tile. */
function firstZ(board: BoardId, zone: ZoneId): number {
  let z = Infinity;
  for (const n of store.notes.values()) if (n.board === board && n.zone === zone && n.z < z) z = n.z;
  return z === Infinity ? 1 : z - 1;
}

/** Create a note at the end of a column. `mergeKey` lets the first edits undo together with it. */
export function createNote(
  board: BoardId,
  zone: ZoneId,
  opts: { due?: Weekday; priority?: Priority; mergeKey?: string } = {},
): Note {
  const now = Date.now();
  const note: Note = {
    id: uid(),
    board,
    zone,
    z: firstZ(board, zone),
    priority: opts.priority ?? 'normal',
    strokes: [],
    createdAt: now,
    updatedAt: now,
    status: 'active',
  };
  if (zone === 'week' && opts.due) {
    note.due = opts.due;
    note.dueDate = nextDateFor(opts.due, now);
  }
  if (zone === 'today') note.todaySince = now;
  store.update('create', (tx) => tx.put(note), { mergeKey: opts.mergeKey });
  return note;
}

function patch(label: string, id: string, fn: (n: Note) => Partial<Note> | null, mergeKey?: string) {
  store.update(
    label,
    (tx) => {
      const n = tx.get(id);
      if (!n) return;
      const p = fn(n);
      if (p) tx.put({ ...n, ...p, updatedAt: Date.now() });
    },
    { mergeKey },
  );
}

// ---- ink -------------------------------------------------------------------------

export function addStroke(id: string, stroke: Stroke) {
  // Last line of defence: a stroke with a non-finite point would corrupt the note.
  if (!stroke.points.length || stroke.points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) return;
  patch('ink', id, (n) => ({ strokes: [...n.strokes, stroke] }));
}

/** Remove strokes by index (eraser / scribble-out). */
export function eraseStrokes(id: string, indices: number[]) {
  if (!indices.length) return;
  const drop = new Set(indices);
  patch('erase', id, (n) => ({ strokes: n.strokes.filter((_, i) => !drop.has(i)) }));
}

/** Move a lasso selection by (dx, dy) page units. */
export function moveStrokes(id: string, indices: number[], dx: number, dy: number) {
  if (!indices.length || (!dx && !dy)) return;
  const sel = new Set(indices);
  patch('move ink', id, (n) => ({
    strokes: n.strokes.map((s, i) =>
      sel.has(i) ? { ...s, points: s.points.map(([x, y, p]) => [Math.round((x + dx) * 100) / 100, Math.round((y + dy) * 100) / 100, p]) } : s,
    ),
  }));
}

// ---- text / photos ------------------------------------------------------------------

/** Set a note's text. Calls sharing `mergeKey` (one editing session) undo as one step. */
export function setText(id: string, text: string, mergeKey: string) {
  patch('text', id, (n) => ((n.text ?? '') === text ? null : { text: text || undefined }), mergeKey);
}

export function addImages(id: string, imageIds: string[], mergeKey?: string) {
  patch('photo', id, (n) => ({ imageIds: [...(n.imageIds ?? []), ...imageIds] }), mergeKey);
}

/** Replace one photo with another (Retake). */
export function replaceImage(id: string, oldId: string, newId: string) {
  patch('photo', id, (n) => {
    const markup = { ...(n.markup ?? {}) };
    delete markup[oldId];
    return {
      imageIds: (n.imageIds ?? []).map((x) => (x === oldId ? newId : x)),
      markup: Object.keys(markup).length ? markup : undefined,
    };
  });
}

/** Take a photo off a note. The bytes stay until next launch so this can be undone. */
export function removeImage(id: string, imageId: string) {
  patch('remove photo', id, (n) => {
    if (!n.imageIds) return null;
    const imageIds = n.imageIds.filter((x) => x !== imageId);
    const markup = { ...(n.markup ?? {}) };
    delete markup[imageId];
    return {
      imageIds: imageIds.length ? imageIds : undefined,
      markup: Object.keys(markup).length ? markup : undefined,
    };
  });
}

export function addMarkup(id: string, imageId: string, stroke: Stroke) {
  patch('markup', id, (n) => {
    const markup = { ...(n.markup ?? {}) };
    markup[imageId] = [...(markup[imageId] ?? []), stroke];
    return { markup };
  });
}

// ---- organising ------------------------------------------------------------------------

export function setPriority(id: string, priority: Priority) {
  patch('priority', id, (n) => (n.priority === priority ? null : { priority }));
}

/**
 * Move a note to a column (and board), optionally to a position. Re-numbers the
 * destination column so the order is stable.
 */
export function moveNote(id: string, dest: { board?: BoardId; zone?: ZoneId; due?: Weekday | null; index?: number }) {
  store.update('move', (tx) => {
    const n = tx.get(id);
    if (!n) return;
    const now = Date.now();
    const board = dest.board ?? n.board;
    const zone = dest.zone ?? n.zone;
    let due = dest.due === null ? undefined : (dest.due ?? n.due);
    if (zone !== 'week') due = undefined;
    // A newly chosen day is the next time that weekday comes round; otherwise keep the date.
    const dueDate = !due ? undefined : dest.due ? nextDateFor(dest.due, now) : (n.dueDate ?? nextDateFor(due, now));
    const todaySince = zone !== 'today' ? undefined : n.zone === 'today' ? n.todaySince : now;
    const moved: Note = { ...n, board, zone, due, dueDate, todaySince, updatedAt: now };
    const others = [...store.notes.values()]
      .filter((m) => m.id !== id && m.board === board && m.zone === zone)
      .sort((a, b) => a.z - b.z);
    const index = Math.min(Math.max(dest.index ?? others.length, 0), others.length);
    others.splice(index, 0, moved);
    others.forEach((m, i) => {
      const z = i + 1;
      if (m.id === id) tx.put({ ...moved, z });
      else if (m.z !== z) tx.put({ ...m, z });
    });
  });
}

/** Whole days a note has sat in Today (0 = entered today). */
export function daysInToday(n: Note, now = Date.now()): number {
  if (n.zone !== 'today') return 0;
  return Math.max(0, daysBetween(dayKey(n.todaySince ?? n.createdAt), dayKey(now)));
}

/**
 * The daily check (on open, at midnight, on return, when a note is closed):
 * This Week notes whose day has come move into Today, at the front, with their age
 * counted from that day. Older notes with a day chip but no date get one first.
 * Returns how many moved. Not undoable: it's the calendar, not an edit.
 */
export function rollover(now = Date.now()): number {
  const today = dayKey(now);
  let moved = 0;
  store.update(
    'rollover',
    (tx) => {
      for (const n of [...store.notes.values()]) {
        if (n.status !== 'active' || n.zone !== 'week' || !n.due) continue;
        const dueDate = n.dueDate ?? weekdayInWeekOf(n.due, n.updatedAt);
        if (dueDate <= today) {
          const next: Note = { ...n, zone: 'today', todaySince: dayStart(dueDate), z: firstZ(n.board, 'today'), updatedAt: now };
          delete next.due;
          delete next.dueDate;
          tx.put(next);
          moved++;
        } else if (dueDate !== n.dueDate) {
          tx.put({ ...n, dueDate });
        }
      }
    },
    { undoable: false },
  );
  return moved;
}

/** Start a task (in progress, moved to the front of its column) or pause it again. */
export function setInProgress(id: string, on: boolean) {
  store.update(on ? 'start' : 'pause', (tx) => {
    const n = tx.get(id);
    if (!n || n.status !== 'active' || !!n.startedAt === on) return;
    const now = Date.now();
    if (on) {
      tx.put({ ...n, startedAt: now, z: firstZ(n.board, n.zone), updatedAt: now });
    } else {
      const next: Note = { ...n, updatedAt: now };
      delete next.startedAt;
      tx.put(next);
    }
  });
}

export function completeNote(id: string): number {
  let gained = 0;
  store.update('complete', (tx) => {
    const n = tx.get(id);
    if (!n || n.status === 'done') return;
    gained = PRIORITY[n.priority].xp;
    const now = Date.now();
    const done: Note = { ...n, status: 'done', completedAt: now, xp: gained, updatedAt: now };
    delete done.startedAt;
    tx.put(done);
  });
  return gained;
}

/** Un-complete (from the note sheet, or taking a note back out of the Vault). */
export function restoreNote(id: string) {
  patch('restore', id, (n) =>
    n.status === 'active'
      ? null
      : { status: 'active', completedAt: undefined, xp: undefined, todaySince: n.zone === 'today' ? Date.now() : n.todaySince },
  );
}

export function deleteNote(id: string) {
  store.update('delete', (tx) => tx.remove(id));
}

export function setReminder(id: string, reminder: Reminder | undefined) {
  patch('reminder', id, () => ({ reminder }));
}
