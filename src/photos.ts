import { addImages, isEmpty, replaceImage } from './actions';
import { ImageDecodeError, isImageFile, processImage, saveImage } from './images';
import { store } from './store';
import { toast } from './ui/overlay';

/**
 * Getting photos in: the system picker (Photo Library / Take Photo / Choose File),
 * plus attaching files from drag-and-drop or paste. Everything is processed here on
 * the device; nothing is uploaded.
 */

const inputs: { library: HTMLInputElement | null; camera: HTMLInputElement | null } = { library: null, camera: null };
type Pending = { onFiles: (f: File[]) => void; onCancel: () => void; at: number; settled: boolean };
let pending: Pending | null = null;
/** A picker we assumed was cancelled; iCloud photos can still arrive late, so keep it briefly. */
let assumedCancelled: { p: Pending; until: number } | null = null;

function settle(files: File[] | null, assumed = false) {
  const p = pending;
  if (!p || p.settled) {
    // Files arriving after we guessed "cancelled" (slow iCloud download): still deliver them.
    if (files?.length && assumedCancelled && performance.now() < assumedCancelled.until) {
      const late = assumedCancelled.p;
      assumedCancelled = null;
      late.onFiles(files);
    }
    return;
  }
  p.settled = true;
  pending = null;
  document.removeEventListener('pointerdown', onNextTouch, true);
  if (files && files.length) p.onFiles(files);
  else {
    if (assumed) assumedCancelled = { p, until: performance.now() + 120_000 };
    p.onCancel();
  }
}

/** Fallback cancel detection: if she touches the app again and no files arrived, she cancelled. */
function onNextTouch() {
  if (pending && performance.now() - pending.at > 400) settle(null, true);
}

function ensureInput(kind: 'library' | 'camera'): HTMLInputElement {
  const existing = inputs[kind];
  if (existing) return existing;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  if (kind === 'camera') {
    // The shutter button: straight to the camera.
    input.setAttribute('capture', 'environment');
  } else {
    // No `capture`: iPadOS offers Photo Library, Take Photo and Choose File.
    input.multiple = true;
  }
  input.hidden = true;
  input.addEventListener('change', () => {
    const files = [...(input.files ?? [])];
    input.value = '';
    settle(files);
  });
  input.addEventListener('cancel', () => settle(null));
  document.body.append(input);
  inputs[kind] = input;
  return input;
}

/**
 * Open the system photo picker. MUST be called synchronously inside a tap handler —
 * iPadOS blocks programmatic clicks on file inputs otherwise.
 */
export function pickPhotos(
  onFiles: (files: File[]) => void,
  onCancel: () => void = () => {},
  opts: { camera?: boolean } = {},
) {
  const inp = ensureInput(opts.camera ? 'camera' : 'library');
  settle(null); // a previous picker that never reported back
  assumedCancelled = null;
  pending = { onFiles, onCancel, at: performance.now(), settled: false };
  inp.value = '';
  inp.click();
  setTimeout(() => document.addEventListener('pointerdown', onNextTouch, true), 0);
}

export interface AttachHooks {
  setLoading(id: string, delta: number): void;
}

/**
 * Process and attach image files to a note, one at a time so the Pencil stays smooth.
 * `mergeKey` groups the additions into one undo step (with the note's creation, for a
 * brand-new photo note). With `discardIfEmpty`, a new note that ends up with nothing
 * on it is removed silently.
 */
export async function attachFiles(
  noteId: string,
  files: File[],
  hooks: AttachHooks,
  opts: { mergeKey?: string; discardIfEmpty?: boolean; replace?: string } = {},
) {
  const images = files.filter(isImageFile);
  if (!images.length) {
    if (files.length) toast('Only pictures can be added to notes.');
    if (opts.discardIfEmpty && isEmpty(store.get(noteId))) store.discard(noteId);
    return;
  }
  hooks.setLoading(noteId, images.length);
  let failed = 0;
  for (const file of images) {
    try {
      const rec = await processImage(file);
      const n = store.get(noteId);
      if (!n || n.status !== 'active') continue; // note went away meanwhile; the bytes are collected next launch
      await saveImage(rec);
      if (opts.replace && n.imageIds?.includes(opts.replace)) {
        replaceImage(noteId, opts.replace, rec.id); // Retake swaps the photo in place
        opts.replace = undefined;
      } else addImages(noteId, [rec.id], opts.mergeKey);
    } catch (err) {
      failed++;
      if (!(err instanceof ImageDecodeError)) console.warn('photo failed', err);
    } finally {
      hooks.setLoading(noteId, -1);
    }
  }
  if (failed) {
    toast(failed === images.length && failed === 1 ? 'That picture couldn’t be opened — the note is unchanged.' : `${failed} picture${failed > 1 ? 's' : ''} couldn’t be opened.`, undefined, 4000);
  }
  if (opts.discardIfEmpty && isEmpty(store.get(noteId))) store.discard(noteId);
}

/** Image files from a paste or drop, if any. */
export function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files = [...(data.files ?? [])];
  if (!files.length) {
    for (const item of [...(data.items ?? [])]) {
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
  }
  return files.filter(isImageFile);
}
