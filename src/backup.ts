import { DB_VERSION, getImage, type ImageRecord } from './db';
import { normalizePlayer } from './avatar';
import { isLegacyNote, upgradeNote, upgradeSettings } from './migrate';
import { store } from './store';
import {
  BOARDS,
  PRIORITIES,
  WEEKDAYS,
  type Player,
  ZONES,
  type BoardId,
  type Note,
  type Settings,
  type Stroke,
  type ViewState,
} from './types';
import { computeStats } from './xp';

/**
 * Single-file JSON backup of the whole database. Bump BACKUP_VERSION on format changes.
 *   v1  notes (ink), settings, view
 *   v2  + note text, photo ids and photo markup, and the photos themselves (base64)
 *   v3  grid redesign: priority, due day, the hero's outfit; v1/v2 are upgraded on import
 */
export const BACKUP_FORMAT = 'quest-board-backup';
export const BACKUP_VERSION = 3;

interface BackupImage {
  id: string;
  type: string;
  w: number;
  h: number;
  tw: number;
  th: number;
  createdAt: number;
  /** base64 */
  full: string;
  thumb: string;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  schemaVersion: number;
  exportedAt: string;
  app: string;
  stats: { xp: number; level: number; streak: number };
  settings: Settings;
  view: ViewState;
  player: Player;
  notes: Note[];
  images: BackupImage[];
}

function toBase64(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  const CHUNK = 0x8000;
  let s = '';
  for (let i = 0; i < u8.length; i += CHUNK) s += String.fromCharCode(...u8.subarray(i, i + CHUNK));
  return btoa(s);
}

function fromBase64(b64: string): ArrayBuffer {
  const s = atob(b64);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8.buffer;
}

export interface PreparedBackup {
  file: File;
  bytes: number;
  notes: number;
  photos: number;
}

/** Gather everything (including photo bytes) into one backup file. Async: reads photos from storage. */
export async function prepareBackup(): Promise<PreparedBackup> {
  const notes = [...store.notes.values()];
  const s = computeStats(store.done());
  const ids = [...new Set(notes.flatMap((n) => n.imageIds ?? []))];
  const images: BackupImage[] = [];
  for (const id of ids) {
    const rec = await getImage(id);
    if (!rec) continue;
    images.push({
      id: rec.id,
      type: rec.type,
      w: rec.w,
      h: rec.h,
      tw: rec.tw,
      th: rec.th,
      createdAt: rec.createdAt,
      full: toBase64(rec.full),
      thumb: toBase64(rec.thumb),
    });
  }
  const data: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    schemaVersion: DB_VERSION,
    exportedAt: new Date().toISOString(),
    app: __APP_VERSION__,
    stats: { xp: s.xp, level: s.level, streak: s.streak },
    settings: store.settings,
    view: store.view,
    player: store.player,
    notes,
    images,
  };
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const file = new File([JSON.stringify(data)], `quest-board-backup-${stamp}.json`, { type: 'application/json' });
  return { file, bytes: file.size, notes: notes.length, photos: images.length };
}

/**
 * Hand the file to the share sheet (→ Save to Files) or download it. Must be called
 * straight from a tap — Safari needs the user gesture for navigator.share — so the
 * file is prepared beforehand and nothing async happens before share().
 */
export async function saveBackupFile(file: File): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Quest Board backup' });
      store.markExported();
      return 'shared';
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled';
      // Fall through to a download if sharing failed for another reason.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  store.markExported();
  return 'downloaded';
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ---- import -----------------------------------------------------------------

export interface ImportSummary {
  player?: Player;
  notes: Note[];
  images: ImageRecord[];
  photoBytes: number;
  settings?: Settings;
  view?: ViewState;
  exportedAt: string;
  counts: Record<BoardId, number>;
  done: number;
  xp: number;
}

const HEX = /^#[0-9a-f]{6}$/i;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length <= max;

function cleanStroke(s: any): Stroke {
  if (!s || !str(s.color, 7) || !HEX.test(s.color) || !num(s.size) || !Array.isArray(s.points)) {
    throw new Error('A stroke is malformed.');
  }
  const points = s.points.map((p: unknown) => {
    if (!Array.isArray(p) || p.length < 3 || !num(p[0]) || !num(p[1]) || !num(p[2])) throw new Error('A stroke point is malformed.');
    return [p[0], p[1], p[2]] as [number, number, number];
  });
  const out: Stroke = { color: s.color, size: s.size, tilt: num(s.tilt) ? Math.min(Math.max(s.tilt, 0), 1) : 0, points };
  if (s.tool === 'highlighter') out.tool = 'highlighter';
  return out;
}

function cleanNote(raw: any): Note {
  if (raw && typeof raw === 'object' && isLegacyNote(raw)) {
    // Old free-board note: same validation it always had, then the same upgrade the database does.
    if (!Array.isArray(raw.strokes)) throw new Error('A note has no strokes list.');
    raw = { ...raw, strokes: raw.strokes.map(cleanStroke) };
    try {
      raw = upgradeNote(raw);
    } catch {
      throw new Error('A note is malformed.');
    }
  }
  const n = raw;
  if (!n || !str(n.id, 100) || !n.id) throw new Error('A note is missing its id.');
  if (!BOARDS.includes(n.board) || !ZONES.includes(n.zone)) throw new Error('A note has an unknown board or zone.');
  if (!num(n.z) || !num(n.createdAt) || !num(n.updatedAt)) throw new Error('A note has bad numbers.');
  if (!PRIORITIES.includes(n.priority)) throw new Error('A note has an unknown priority.');
  if (n.status !== 'active' && n.status !== 'done') throw new Error('A note has an unknown status.');
  if (!Array.isArray(n.strokes)) throw new Error('A note has no strokes list.');
  const note: Note = {
    id: n.id,
    board: n.board,
    zone: n.zone,
    z: n.z,
    priority: n.priority,
    strokes: n.strokes.map(cleanStroke),
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    status: n.status,
  };
  if (n.reminder && str(n.reminder.label) && str(n.reminder.due, 40)) note.reminder = { label: n.reminder.label, due: n.reminder.due };
  if (n.zone === 'week' && WEEKDAYS.includes(n.due)) {
    note.due = n.due;
    if (typeof n.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(n.dueDate)) note.dueDate = n.dueDate;
  }
  if (n.zone === 'today' && num(n.todaySince)) note.todaySince = n.todaySince;
  if (n.status !== 'done' && num(n.startedAt)) note.startedAt = n.startedAt;
  if (num(n.completedAt)) note.completedAt = n.completedAt;
  if (num(n.xp)) note.xp = n.xp;
  if (typeof n.text === 'string' && n.text.length <= 20000 && n.text.trim()) note.text = n.text;
  if (Array.isArray(n.imageIds) && n.imageIds.every((x: unknown) => str(x, 100))) {
    if (n.imageIds.length) note.imageIds = [...n.imageIds];
  }
  if (n.markup && typeof n.markup === 'object' && note.imageIds) {
    const markup: Record<string, Stroke[]> = {};
    for (const [id, strokes] of Object.entries(n.markup)) {
      if (note.imageIds.includes(id) && Array.isArray(strokes) && strokes.length) markup[id] = strokes.map(cleanStroke);
    }
    if (Object.keys(markup).length) note.markup = markup;
  }
  return note;
}

/** The hero's look: validated (and upgraded from older backups) by the same rules as storage. */
function cleanPlayer(p: unknown): Player | undefined {
  return p && typeof p === 'object' ? normalizePlayer(p) : undefined;
}

const dim = (v: unknown): v is number => num(v) && v > 0 && v <= 20000;

function cleanImage(i: any): ImageRecord {
  if (!i || !str(i.id, 100) || !i.id || !str(i.type, 40) || !i.type.startsWith('image/')) throw new Error('A photo is malformed.');
  if (!dim(i.w) || !dim(i.h) || !dim(i.tw) || !dim(i.th) || typeof i.full !== 'string' || typeof i.thumb !== 'string') {
    throw new Error('A photo is malformed.');
  }
  let full: ArrayBuffer;
  let thumb: ArrayBuffer;
  try {
    full = fromBase64(i.full);
    thumb = fromBase64(i.thumb);
  } catch {
    throw new Error('A photo’s data is damaged.');
  }
  return {
    id: i.id,
    type: i.type,
    w: i.w,
    h: i.h,
    tw: i.tw,
    th: i.th,
    full,
    thumb,
    bytes: full.byteLength + thumb.byteLength,
    createdAt: num(i.createdAt) ? i.createdAt : Date.now(),
  };
}

export function parseBackup(text: string): ImportSummary {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t valid JSON.');
  }
  if (data?.format !== BACKUP_FORMAT) throw new Error('That file isn’t a Quest Board backup.');
  if (!num(data.version) || data.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of the app. Update the app first.');
  }
  if (!Array.isArray(data.notes)) throw new Error('The backup has no notes list.');
  const notes: Note[] = data.notes.map(cleanNote);
  // v1 backups have no photos; v2 carry them alongside the notes.
  const images: ImageRecord[] = Array.isArray(data.images) ? data.images.map(cleanImage) : [];
  const imageIds = new Set(images.map((i) => i.id));
  for (const n of notes) {
    // Drop references to photos the file doesn't contain, so nothing points at nothing.
    if (n.imageIds && n.imageIds.some((id) => !imageIds.has(id))) {
      n.imageIds = n.imageIds.filter((id) => imageIds.has(id));
      if (!n.imageIds.length) delete n.imageIds;
      if (n.markup) for (const k of Object.keys(n.markup)) if (!n.imageIds?.includes(k)) delete n.markup[k];
    }
  }
  const ids = new Set<string>();
  for (const n of notes) {
    if (ids.has(n.id)) throw new Error('The backup contains duplicate notes.');
    ids.add(n.id);
  }
  const counts: Record<BoardId, number> = { work: 0, personal: 0 };
  let done = 0;
  for (const n of notes) {
    if (n.status === 'active') counts[n.board]++;
    else done++;
  }
  let settings: Settings | undefined;
  if (data.settings && str(data.settings.inkColor, 7) && HEX.test(data.settings.inkColor)) {
    const up = data.version < 3 ? upgradeSettings(data.settings) : data.settings;
    const tool = ['pen', 'highlighter', 'eraser', 'lasso'].includes(up.tool) ? up.tool : 'pen';
    settings = { inkColor: up.inkColor, tool, sound: !!up.sound };
  }
  const view: ViewState | undefined = data.view && BOARDS.includes(data.view.board) ? { board: data.view.board } : undefined;
  const player = cleanPlayer(data.player);
  return {
    notes,
    images,
    player,
    photoBytes: images.reduce((t, i) => t + i.bytes, 0),
    settings,
    view,
    exportedAt: str(data.exportedAt, 40) ? data.exportedAt : '',
    counts,
    done,
    xp: computeStats(notes.filter((n) => n.status === 'done')).xp,
  };
}
