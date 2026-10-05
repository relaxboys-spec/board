import { normalizePlayer } from './avatar';
import { loadAll, writeBatch, replaceAll, type ImageRecord } from './db';
import {
  DEFAULT_PLAYER,
  DEFAULT_SETTINGS,
  type BoardId,
  type Note,
  type Player,
  type Settings,
  type ViewState,
} from './types';

/**
 * In-memory source of truth. Notes are treated as immutable values: every change
 * puts a new object, so undo snapshots are just the previous references (cheap).
 * Persistence is a debounced write of whatever changed, flushed immediately when
 * the app is backgrounded.
 */

export interface BackupMeta {
  lastExportAt?: number;
}
export interface InstallMeta {
  firstLaunchAt: number;
  persistRequested?: boolean;
}

interface Change {
  id: string;
  before: Note | null;
  after: Note | null;
}
interface UndoEntry {
  label: string;
  changes: Change[];
  /** Later updates with the same key fold into this entry (one text-editing session = one undo). */
  mergeKey?: string;
}

export interface Tx {
  get(id: string): Note | undefined;
  put(note: Note): void;
  remove(id: string): void;
}

export type StoreEvent =
  | { type: 'notes'; ids: Set<string>; reason: string }
  | { type: 'settings' }
  | { type: 'player' }
  | { type: 'reset' };

const UNDO_LIMIT = 100;
const SAVE_DELAY = 250;

class Store {
  notes = new Map<string, Note>();
  settings: Settings = { ...DEFAULT_SETTINGS };
  view: ViewState = { board: 'work' };
  player: Player = { ...DEFAULT_PLAYER };
  backup: BackupMeta = {};
  install: InstallMeta = { firstLaunchAt: Date.now() };
  isFirstLaunch = false;

  private listeners = new Set<(e: StoreEvent) => void>();
  private undoStack: UndoEntry[] = [];
  private redoStack: UndoEntry[] = [];
  private dirtyNotes = new Set<string>();
  private dirtyMeta = new Set<'settings' | 'view' | 'backup' | 'install' | 'player'>();
  private saveTimer: number | undefined;
  private saveDue = 0;
  private saving: Promise<void> = Promise.resolve();
  onSaveError: (err: unknown) => void = () => {};

  async load(): Promise<void> {
    const { notes, meta } = await loadAll();
    for (const n of notes) this.notes.set(n.id, n);
    this.settings = { ...DEFAULT_SETTINGS, ...(meta.settings ?? {}) };
    if (meta.view) this.view = { board: meta.view.board === 'personal' ? 'personal' : 'work' };
    // Upgrades the earlier six-outfit Nova to the current wardrobe (see normalizePlayer).
    this.player = normalizePlayer(meta.player);
    if (JSON.stringify(this.player) !== JSON.stringify(meta.player ?? null)) this.dirtyMeta.add('player');
    this.backup = meta.backup ?? {};
    if (meta.install) {
      this.install = meta.install;
    } else {
      this.isFirstLaunch = true;
      this.dirtyMeta.add('install');
      this.scheduleSave();
    }
  }

  on(fn: (e: StoreEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: StoreEvent) {
    for (const fn of this.listeners) fn(e);
  }

  // ---- notes ---------------------------------------------------------------

  get(id: string) {
    return this.notes.get(id);
  }

  activeOn(board: BoardId): Note[] {
    const out: Note[] = [];
    for (const n of this.notes.values()) if (n.board === board && n.status === 'active') out.push(n);
    return out;
  }

  done(): Note[] {
    const out: Note[] = [];
    for (const n of this.notes.values()) if (n.status === 'done') out.push(n);
    return out;
  }

  maxZ(): number {
    let z = 0;
    for (const n of this.notes.values()) if (n.z > z) z = n.z;
    return z;
  }

  /**
   * Apply a set of note changes atomically. `undoable: false` skips the undo stack;
   * `mergeKey` folds the changes into the previous undo entry when that entry has the
   * same key (e.g. creating a dictated note and every word typed into it).
   */
  update(
    label: string,
    mutate: (tx: Tx) => void,
    opts: { undoable?: boolean; mergeKey?: string } = {},
  ): Set<string> {
    const changes = new Map<string, Change>();
    const tx: Tx = {
      get: (id) => this.notes.get(id),
      put: (note) => {
        const prev = changes.get(note.id);
        changes.set(note.id, { id: note.id, before: prev ? prev.before : this.notes.get(note.id) ?? null, after: note });
        this.notes.set(note.id, note);
      },
      remove: (id) => {
        const prev = changes.get(id);
        const before = prev ? prev.before : this.notes.get(id) ?? null;
        if (!before && !prev) return;
        changes.set(id, { id, before, after: null });
        this.notes.delete(id);
      },
    };
    mutate(tx);
    if (changes.size === 0) return new Set();

    if (opts.undoable !== false) {
      this.redoStack = [];
      const last = this.undoStack[this.undoStack.length - 1];
      if (opts.mergeKey && last && last.mergeKey === opts.mergeKey) {
        for (const c of changes.values()) {
          const existing = last.changes.find((x) => x.id === c.id);
          if (existing) existing.after = c.after;
          else last.changes.push(c);
        }
      } else {
        this.undoStack.push({ label, changes: [...changes.values()], mergeKey: opts.mergeKey });
        if (this.undoStack.length > UNDO_LIMIT) this.undoStack.shift();
      }
    }
    const ids = new Set(changes.keys());
    for (const id of ids) this.dirtyNotes.add(id);
    this.scheduleSave();
    this.emit({ type: 'notes', ids, reason: label });
    return ids;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  undo(): string | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    // Update the stacks before notifying, so listeners see canRedo() correctly.
    this.redoStack.push(entry);
    this.applyEntry(entry, 'before', 'undo');
    return entry.label;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  redo(): string | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push({ ...entry, mergeKey: undefined });
    this.applyEntry(entry, 'after', 'redo');
    return entry.label;
  }

  /** Label of the newest undo step (lets a sheet undo only its own strokes). */
  lastUndoLabel(): string | null {
    return this.undoStack[this.undoStack.length - 1]?.label ?? null;
  }

  private applyEntry(entry: UndoEntry, side: 'before' | 'after', reason: string) {
    const ids = new Set<string>();
    const list = side === 'before' ? [...entry.changes].reverse() : entry.changes;
    for (const c of list) {
      const v = c[side];
      if (v) this.notes.set(c.id, v);
      else this.notes.delete(c.id);
      ids.add(c.id);
      this.dirtyNotes.add(c.id);
    }
    this.scheduleSave();
    this.emit({ type: 'notes', ids, reason });
  }

  /** Remove a note and erase it from undo history entirely (used for untouched empty notes). */
  discard(id: string) {
    if (!this.notes.has(id)) return;
    this.notes.delete(id);
    const strip = (list: UndoEntry[]) =>
      list.map((e) => ({ ...e, changes: e.changes.filter((c) => c.id !== id) })).filter((e) => e.changes.length > 0);
    this.undoStack = strip(this.undoStack);
    this.redoStack = strip(this.redoStack);
    this.dirtyNotes.add(id);
    this.scheduleSave();
    this.emit({ type: 'notes', ids: new Set([id]), reason: 'discard' });
  }

  // ---- meta ----------------------------------------------------------------

  setSettings(patch: Partial<Settings>) {
    this.settings = { ...this.settings, ...patch };
    this.dirtyMeta.add('settings');
    this.scheduleSave();
    this.emit({ type: 'settings' });
  }

  setBoard(board: BoardId) {
    this.view = { ...this.view, board };
    this.dirtyMeta.add('view');
    this.scheduleSave();
  }

  setPlayer(patch: Partial<Player>) {
    this.player = { ...this.player, ...patch };
    this.dirtyMeta.add('player');
    this.scheduleSave();
    this.emit({ type: 'player' });
  }

  markExported() {
    this.backup = { ...this.backup, lastExportAt: Date.now() };
    this.dirtyMeta.add('backup');
    this.scheduleSave();
  }

  markPersistRequested() {
    this.install = { ...this.install, persistRequested: true };
    this.dirtyMeta.add('install');
    this.scheduleSave();
  }

  /** Replace all data (import). */
  async reset(
    notes: Note[],
    meta: { settings?: Settings; view?: ViewState; backup?: BackupMeta; player?: Player },
    images: ImageRecord[] = [],
  ) {
    await this.flush();
    const install = this.install;
    const backup = { ...this.backup, ...(meta.backup ?? {}) };
    const settings = { ...DEFAULT_SETTINGS, ...(meta.settings ?? {}) };
    const view = meta.view ?? { board: 'work' as BoardId };
    const player = normalizePlayer(meta.player);
    await replaceAll(notes, { settings, view, backup, install, player }, images);
    this.notes = new Map(notes.map((n) => [n.id, n]));
    this.settings = settings;
    this.view = view;
    this.player = player;
    this.backup = backup;
    this.undoStack = [];
    this.redoStack = [];
    this.emit({ type: 'reset' });
  }

  // ---- persistence ---------------------------------------------------------

  private scheduleSave(delay = SAVE_DELAY) {
    const due = Date.now() + delay;
    if (this.saveTimer !== undefined) {
      if (due >= this.saveDue) return;
      clearTimeout(this.saveTimer);
    }
    this.saveDue = due;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = undefined;
      void this.flush();
    }, delay);
  }

  /** Write everything dirty now. Safe to call repeatedly; writes are serialised. */
  flush(): Promise<void> {
    if (this.saveTimer !== undefined) {
      clearTimeout(this.saveTimer);
      this.saveTimer = undefined;
    }
    if (this.dirtyNotes.size === 0 && this.dirtyMeta.size === 0) return this.saving;
    const ids = [...this.dirtyNotes];
    const metaKeys = [...this.dirtyMeta];
    this.dirtyNotes.clear();
    this.dirtyMeta.clear();
    const puts: Note[] = [];
    const deletes: string[] = [];
    for (const id of ids) {
      const n = this.notes.get(id);
      if (n) puts.push(n);
      else deletes.push(id);
    }
    const meta: Record<string, unknown> = {};
    for (const k of metaKeys) meta[k] = this[k];
    this.saving = this.saving
      .then(() => writeBatch(puts, deletes, meta))
      .catch((err) => {
        // Put the work back so the next flush retries it.
        for (const id of ids) this.dirtyNotes.add(id);
        for (const k of metaKeys) this.dirtyMeta.add(k);
        this.onSaveError(err);
        window.setTimeout(() => this.scheduleSave(), 2000);
      });
    return this.saving;
  }
}

export const store = new Store();
