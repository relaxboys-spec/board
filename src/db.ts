import { upgradeNote, upgradeSettings } from './migrate';
import type { Note } from './types';

/**
 * Versioned IndexedDB schema. To change the schema, bump DB_VERSION and append a
 * migration; every migration from the stored version up to DB_VERSION runs in order
 * inside the upgrade transaction.
 *
 *   v1  notes, meta
 *   v2  images (photo blobs). Existing notes are untouched: text / imageIds / markup
 *       are optional fields.
 *   v3  grid redesign: rarity → priority, ink moved onto the 1000×800 page and
 *       recoloured for dark cards, free-board positions and stacks dropped.
 */
const DB_NAME = 'quest-board';
export const DB_VERSION = 3;

type Migration = (db: IDBDatabase, tx: IDBTransaction) => void;

const MIGRATIONS: Record<number, Migration> = {
  1: (db) => {
    const notes = db.createObjectStore('notes', { keyPath: 'id' });
    notes.createIndex('board', 'board');
    notes.createIndex('status', 'status');
    db.createObjectStore('meta', { keyPath: 'key' });
  },
  2: (db) => {
    db.createObjectStore('images', { keyPath: 'id' });
  },
  3: (_db, tx) => {
    const notes = tx.objectStore('notes');
    notes.openCursor().onsuccess = (e) => {
      const c = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (!c) return;
      c.update(upgradeNote(c.value));
      c.continue();
    };
    const meta = tx.objectStore('meta');
    meta.get('settings').onsuccess = (e) => {
      const row = (e.target as IDBRequest<{ key: string; value: unknown } | undefined>).result;
      if (row) meta.put({ key: 'settings', value: upgradeSettings(row.value) });
    };
    meta.get('view').onsuccess = (e) => {
      const row = (e.target as IDBRequest<{ key: string; value: any } | undefined>).result;
      if (row) meta.put({ key: 'view', value: { board: row.value?.board === 'personal' ? 'personal' : 'work' } });
    };
  },
};

/**
 * A stored photo. Bytes are kept as ArrayBuffers rather than Blobs: some iPadOS
 * versions lose Blobs stored in IndexedDB by Home Screen apps across restarts.
 */
export interface ImageRecord {
  id: string;
  type: string;
  /** Full image (longest edge ≤ 2048). */
  w: number;
  h: number;
  full: ArrayBuffer;
  /** Thumbnail (longest edge ≤ 400). */
  tw: number;
  th: number;
  thumb: ArrayBuffer;
  bytes: number;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      const tx = req.transaction!;
      for (let v = e.oldVersion + 1; v <= DB_VERSION; v++) MIGRATIONS[v]?.(db, tx);
    };
    req.onsuccess = () => {
      const db = req.result;
      // Another tab upgraded the schema: let it proceed; we'll reopen next launch.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database upgrade blocked by another open copy of the app.'));
  });
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadAll(): Promise<{ notes: Note[]; meta: Record<string, any> }> {
  const db = await openDb();
  const tx = db.transaction(['notes', 'meta'], 'readonly');
  const [notes, metaRows] = await Promise.all([
    request(tx.objectStore('notes').getAll() as IDBRequest<Note[]>),
    request(tx.objectStore('meta').getAll() as IDBRequest<{ key: string; value: unknown }[]>),
  ]);
  const meta: Record<string, any> = {};
  for (const row of metaRows) meta[row.key] = row.value;
  return { notes, meta };
}

/** Writes changed notes, deletes removed ones, and saves meta keys — all in one transaction. */
export async function writeBatch(
  puts: Note[],
  deletes: string[],
  meta: Record<string, unknown>,
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['notes', 'meta'], 'readwrite');
  const notes = tx.objectStore('notes');
  for (const n of puts) notes.put(n);
  for (const id of deletes) notes.delete(id);
  const metaStore = tx.objectStore('meta');
  for (const [key, value] of Object.entries(meta)) metaStore.put({ key, value });
  // Ask the browser to flush promptly — important when the app is being backgrounded.
  (tx as IDBTransaction & { commit?: () => void }).commit?.();
  return done(tx);
}

/** Replaces everything (used by import). */
export async function replaceAll(notes: Note[], meta: Record<string, unknown>, images: ImageRecord[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['notes', 'meta', 'images'], 'readwrite');
  const noteStore = tx.objectStore('notes');
  const metaStore = tx.objectStore('meta');
  const imageStore = tx.objectStore('images');
  noteStore.clear();
  metaStore.clear();
  imageStore.clear();
  for (const n of notes) noteStore.put(n);
  for (const [key, value] of Object.entries(meta)) metaStore.put({ key, value });
  for (const img of images) imageStore.put(img);
  return done(tx);
}

// ---- images ---------------------------------------------------------------------

export async function putImage(rec: ImageRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('images', 'readwrite');
  tx.objectStore('images').put(rec);
  return done(tx);
}

export async function getImage(id: string): Promise<ImageRecord | undefined> {
  const db = await openDb();
  return request(db.transaction('images').objectStore('images').get(id) as IDBRequest<ImageRecord | undefined>);
}

export async function imageKeys(): Promise<string[]> {
  const db = await openDb();
  return request(db.transaction('images').objectStore('images').getAllKeys() as IDBRequest<string[]>);
}

export async function deleteImages(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await openDb();
  const tx = db.transaction('images', 'readwrite');
  for (const id of ids) tx.objectStore('images').delete(id);
  return done(tx);
}

/** Count and total bytes of stored photos (walks the store without loading every blob at once). */
export async function imageUsage(): Promise<{ count: number; bytes: number }> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    let count = 0;
    let bytes = 0;
    const req = db.transaction('images').objectStore('images').openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return resolve({ count, bytes });
      count++;
      bytes += (c.value as ImageRecord).bytes ?? 0;
      c.continue();
    };
    req.onerror = () => reject(req.error);
  });
}
