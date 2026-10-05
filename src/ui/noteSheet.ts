import { addStroke, daysInToday, eraseStrokes, hasText, isEmpty, moveNote, moveStrokes, setPriority, setText } from '../actions';
import { dayStart, weekEndKey } from '../days';
import { pathFor, strokeAlpha } from '../ink';
import { drawPage, hitPhoto, pageTransform, textBox } from '../page';
import { store } from '../store';
import { StrokeCapture } from '../stroke';
import {
  BOARDS,
  BOARD_LABEL,
  HIGHLIGHTER_SIZE,
  INK_COLORS,
  PEN_SIZE,
  PRIORITIES,
  PRIORITY,
  WEEKDAYS,
  WEEKDAY_LABEL,
  type InkPoint,
  type Note,
  type Stroke,
  type Tool,
  type Weekday,
  type ZoneId,
} from '../types';
import { el, formatDue } from '../util';

/**
 * The note sheet (design: Write.dc.html + View.dc.html). One component, four modes:
 *   write  Pencil ink with pen / highlighter / eraser / lasso, scribble-out to erase
 *   speak  keyboard dictation into a big text field (the app never touches audio)
 *   photo  the note's photos as a taped polaroid; Library / camera / Retake
 *   view   read-only note + info, actions and the Complete button
 * The note is saved continuously; "Add to board" just closes the sheet.
 */

export type SheetMode = 'write' | 'speak' | 'photo' | 'view';

export interface SheetHost {
  undo(): void;
  redo(): void;
  openViewer(id: string, index: number): void;
  /** Must open the system picker synchronously (called from a tap). */
  pickPhotos(id: string, camera: boolean, replace?: string): void;
  complete(id: string, from: DOMRect | null): void;
  uncomplete(id: string): void;
  remind(id: string): void;
  deleteNote(id: string): void;
  closed(id: string): void;
}

const ICONS = {
  pen: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 7l3 3"/>',
  mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  photo: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  highlighter: '<path d="M9 15l-3 3h-3l2-2"/><path d="M8 13l7-9 5 5-9 7z"/>',
  eraser: '<path d="M8 20h12"/><path d="M4 16l9-9 6 6-7 7H8z"/><path d="M9 11l6 6"/>',
  lasso: '<ellipse cx="12" cy="10" rx="8" ry="5" stroke-dasharray="3 3"/><path d="M8 15c-1 3 1 5 3 5"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  library: '<rect x="3" y="5" width="18" height="14" rx="1"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
  retake: '<path d="M4 12a8 8 0 0 1 14-5l2 2"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5l-2-2"/><path d="M4 20v-5h5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  edit: '<path d="M4 20l4-1 11-11-3-3L5 16z"/>',
  move: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
};

function icon(name: keyof typeof ICONS, size = 22, stroke = 'currentColor', width = 2.2) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

function btn(cls: string, html: string, onClick: (e: MouseEvent) => void, label?: string): HTMLButtonElement {
  const b = el('button', cls);
  b.type = 'button';
  b.innerHTML = html;
  if (label) b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  return b;
}

/** "Today", "Wed", "Next Wed", "This week" or "Someday". */
const DUE_LABEL = (n: Note) =>
  n.zone === 'today'
    ? 'Today'
    : n.zone === 'someday'
      ? 'Someday'
      : n.due
        ? (n.dueDate && n.dueDate > weekEndKey() ? 'Next ' : '') + WEEKDAY_LABEL[n.due]
        : 'This week';

/** Long form for the note info: "Wed 7 Oct". */
function dueLong(n: Note): string {
  if (n.zone === 'week' && n.dueDate) {
    return new Date(dayStart(n.dueDate)).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  }
  return DUE_LABEL(n);
}

export class NoteSheet {
  private wrap: HTMLDivElement | null = null;
  private frame!: HTMLDivElement;
  private head!: HTMLDivElement;
  private tabs!: HTMLDivElement;
  private canvasWrap!: HTMLDivElement;
  private page!: HTMLCanvasElement;
  private live!: HTMLCanvasElement;
  private ring!: HTMLDivElement;
  private hint!: HTMLDivElement;
  private toolbar!: HTMLDivElement;
  private rail!: HTMLDivElement;
  private textarea: HTMLTextAreaElement | null = null;
  private lassoBox: HTMLDivElement | null = null;
  private emptyPhoto: HTMLDivElement | null = null;
  private expandBtn: HTMLButtonElement | null = null;
  private recBtn: HTMLButtonElement | null = null;
  private bars: HTMLElement[] = [];
  private barsTimer: number | undefined;
  private unsub: (() => void) | null = null;
  private ro: ResizeObserver | null = null;
  private w = 0;
  private h = 0;
  private frameReq = 0;
  private cap = new StrokeCapture();
  private eraser: { pointerId: number; hits: Set<number> } | null = null;
  private lasso: { pointerId: number; points: [number, number][] } | null = null;
  private selection: { indices: number[]; strokes: Stroke[] } | null = null;
  private selDrag: { pointerId: number; sx: number; sy: number; dx: number; dy: number } | null = null;
  private touches = new Map<number, { sx: number; sy: number; t0: number }>();
  private twoTap: { t0: number; ok: boolean } | null = null;
  private textKey = '';
  noteId: string | null = null;
  mode: SheetMode = 'write';
  isNew = false;

  constructor(private host: SheetHost) {}

  get isOpen() {
    return !!this.wrap;
  }

  private get note(): Note | undefined {
    return this.noteId ? store.get(this.noteId) : undefined;
  }

  // ===========================================================================
  // open / close

  /**
   * Open a note. Runs synchronously so that, from a tap, Speak can focus the text field
   * (iPadOS only opens the keyboard inside a user gesture) and Photo can open the picker.
   */
  open(id: string, mode: SheetMode, opts: { isNew?: boolean; mergeKey?: string; autoPick?: boolean } = {}) {
    if (this.wrap) this.close();
    if (!store.get(id)) return;
    this.noteId = id;
    this.isNew = !!opts.isNew;
    this.textKey = opts.mergeKey ?? `text:${id}:${Date.now()}`;
    this.build();
    this.unsub = store.on((e) => {
      if (e.type === 'reset') return this.close();
      if (e.type === 'settings') return this.renderToolbar();
      if (e.type !== 'notes' || !this.noteId || !e.ids.has(this.noteId)) return;
      if (!store.get(this.noteId)) return this.close();
      if (this.selection && this.note!.strokes !== this.selection.strokes) this.clearSelection();
      this.refresh();
    });
    this.setMode(mode, opts.autoPick);
  }

  private build() {
    const wrap = el('div', 'qb-sheet-wrap');
    const scrim = el('div', 'qb-sheet-scrim');
    scrim.addEventListener('click', () => this.close());
    const sheet = el('div', 'qb-sheet');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'Note');

    this.frame = el('div', 'qb-note-frame');
    const inner = el('div', 'qb-note-in');
    this.head = el('div', 'qb-note-head');
    this.tabs = el('div', 'qb-modes');
    this.tabs.setAttribute('role', 'tablist');
    this.tabs.setAttribute('aria-label', 'Input');
    for (const [m, label, ic] of [
      ['write', 'Write', 'pen'],
      ['speak', 'Speak', 'mic'],
      ['photo', 'Photo', 'photo'],
    ] as const) {
      const b = btn(`qb-skew qb-mode`, `<span>${icon(ic, 20)}${label}</span>`, () => this.setMode(m, true));
      b.setAttribute('role', 'tab');
      b.dataset.mode = m;
      this.tabs.append(b);
    }
    this.canvasWrap = el('div', 'qb-canvas-wrap');
    this.page = el('canvas', 'qb-page');
    this.live = el('canvas', 'qb-live');
    this.ring = el('div', 'qb-penring');
    this.hint = el('div', 'qb-hint');
    this.canvasWrap.append(this.page, this.live, this.ring);
    this.toolbar = el('div', 'qb-toolbar');
    inner.append(this.head, this.tabs, this.canvasWrap, this.hint, this.toolbar);
    this.frame.append(inner);

    this.rail = el('div', 'qb-rail qb-cut');
    sheet.append(this.frame, this.rail);
    wrap.append(scrim, sheet);
    document.body.append(wrap);
    this.wrap = wrap;

    this.canvasWrap.addEventListener('pointerdown', this.onDown);
    this.canvasWrap.addEventListener('pointermove', this.onMove);
    this.canvasWrap.addEventListener('pointerup', this.onUp);
    this.canvasWrap.addEventListener('pointercancel', this.onCancel);
    this.canvasWrap.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'pen') this.ring.hidden = true;
    });
    this.canvasWrap.addEventListener(
      'touchstart',
      (e) => {
        if (!(e.target as HTMLElement).closest('textarea, button')) e.preventDefault();
      },
      { passive: false },
    );
    this.ro = new ResizeObserver(() => {
      const r = this.canvasWrap.getBoundingClientRect();
      this.w = r.width;
      this.h = r.height;
      this.renderPage();
      this.positionOverlays();
    });
    this.ro.observe(this.canvasWrap);
    window.visualViewport?.addEventListener('resize', this.fitViewport);
    window.visualViewport?.addEventListener('scroll', this.fitViewport);
    document.addEventListener('keydown', this.onKey);
    this.fitViewport();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sheet.animate([{ opacity: 0, transform: 'translateY(18px) scale(.98)' }, { opacity: 1, transform: 'none' }], {
        duration: 200,
        easing: 'cubic-bezier(.2,.9,.3,1)',
      });
    }
  }

  /** Keep the sheet inside the visible area when the keyboard is up. */
  private fitViewport = () => {
    if (!this.wrap) return;
    const vv = window.visualViewport;
    this.wrap.style.top = (vv?.offsetTop ?? 0) + 'px';
    this.wrap.style.height = (vv?.height ?? window.innerHeight) + 'px';
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !this.textarea?.matches(':focus')) this.close();
  };

  /** Put the note back. An untouched empty note disappears silently. */
  close() {
    if (!this.wrap) return;
    this.flush();
    const id = this.noteId!;
    const wrap = this.wrap;
    this.wrap = null;
    this.unsub?.();
    this.unsub = null;
    this.ro?.disconnect();
    window.visualViewport?.removeEventListener('resize', this.fitViewport);
    window.visualViewport?.removeEventListener('scroll', this.fitViewport);
    document.removeEventListener('keydown', this.onKey);
    clearTimeout(this.barsTimer);
    this.textarea?.blur();
    this.textarea = null;
    this.selection = null;
    this.noteId = null;
    if (isEmpty(store.get(id))) store.discard(id);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) wrap.remove();
    else {
      const a = wrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150 });
      a.onfinish = () => wrap.remove();
      window.setTimeout(() => wrap.remove(), 400);
    }
    this.host.closed(id);
  }

  /** Commit anything in flight (app going to background). */
  flush() {
    if (this.cap.active) this.commitStroke();
    if (this.textarea && this.noteId) setText(this.noteId, this.textarea.value, this.textKey);
  }

  // ===========================================================================
  // modes

  setMode(mode: SheetMode, fromTap = false) {
    const n = this.note;
    if (!n || !this.wrap) return;
    const prev = this.mode;
    this.mode = mode;
    if (prev === 'speak' && mode !== 'speak' && this.textarea) {
      setText(n.id, this.textarea.value, this.textKey);
      this.textarea.remove();
      this.textarea = null;
    }
    this.clearSelection();
    this.ring.hidden = true;
    this.wrap.classList.toggle('is-view', mode === 'view');
    this.wrap.dataset.mode = mode;
    for (const b of this.tabs.querySelectorAll<HTMLButtonElement>('.qb-mode')) {
      const on = b.dataset.mode === mode;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    }
    if (mode === 'speak') this.startSpeak();
    this.refresh();
    // Photo tab with no photo yet: go straight to the picker (synchronously, inside the tap).
    if (mode === 'photo' && fromTap && !n.imageIds?.length) this.host.pickPhotos(n.id, false);
  }

  /** Re-draw everything that depends on the note. */
  private refresh() {
    const n = this.note;
    if (!n) return;
    const pr = PRIORITY[n.priority];
    this.frame.style.setProperty('--grad', pr.grad);
    this.frame.style.setProperty('--light', pr.light);
    this.renderHead(n);
    this.renderToolbar();
    this.renderRail(n);
    this.renderHint(n);
    this.renderPage();
    this.positionOverlays();
  }

  private renderHead(n: Note) {
    const pr = PRIORITY[n.priority];
    const tag =
      this.mode === 'view'
        ? el('span', 'qb-skew qb-tag pri', pr.label)
        : el('span', 'qb-skew qb-tag', this.isNew ? 'New Task' : 'Editing');
    const meta = el(
      'span',
      'qb-note-meta',
      this.mode === 'view' ? `${BOARD_LABEL[n.board]} · Due ${DUE_LABEL(n)}` : `${pr.label} · ${DUE_LABEL(n)}`,
    );
    this.head.replaceChildren(tag, meta, el('span', 'qb-flex'), el('span', 'qb-note-xp', `+${pr.xp} XP`));
  }

  private renderHint(n: Note) {
    const t =
      this.mode === 'write'
        ? 'One task per note · Scribble out to erase'
        : this.mode === 'speak'
          ? 'Tap the mic key on the keyboard · Write over any word with the Pencil to fix it'
          : this.mode === 'photo'
            ? n.imageIds?.length
              ? 'Tap the photo to open it · Write a caption with the Pencil'
              : 'Add a photo from your library or the camera'
            : '';
    this.hint.textContent = t;
    this.hint.hidden = !t;
  }

  // ---- toolbar -------------------------------------------------------------------------

  private renderToolbar() {
    if (!this.wrap) return;
    const n = this.note;
    if (!n) return;
    this.toolbar.replaceChildren();
    this.recBtn = null;
    this.bars = [];
    if (this.mode === 'write') {
      const tool = store.settings.tool;
      const tools: [Tool, keyof typeof ICONS, string][] = [
        ['pen', 'pen', 'Pen'],
        ['highlighter', 'highlighter', 'Highlighter'],
        ['eraser', 'eraser', 'Eraser'],
        ['lasso', 'lasso', 'Lasso'],
      ];
      for (const [t, ic, label] of tools) {
        const b = btn('qb-tool' + (tool === t ? ' on' : ''), icon(ic, 24), () => this.setTool(t), label);
        b.setAttribute('aria-pressed', String(tool === t));
        this.toolbar.append(b);
      }
      this.toolbar.append(el('div', 'qb-tool-sep'));
      for (const c of INK_COLORS) {
        const on = store.settings.inkColor === c.value;
        const b = btn('qb-inkbtn' + (on ? ' on' : ''), `<span style="background:${c.value}"></span>`, () => {
          store.setSettings({ inkColor: c.value, tool: tool === 'eraser' || tool === 'lasso' ? 'pen' : tool });
        }, `Ink ${c.label}`);
        b.setAttribute('aria-pressed', String(on));
        this.toolbar.append(b);
      }
      this.toolbar.append(el('div', 'qb-tool-sep'));
      const undo = btn('qb-tool', icon('undo', 22), () => this.host.undo(), 'Undo stroke');
      const redo = btn('qb-tool', icon('redo', 22), () => this.host.redo(), 'Redo stroke');
      undo.disabled = !store.canUndo();
      redo.disabled = !store.canRedo();
      this.toolbar.append(undo, redo);
    } else if (this.mode === 'speak') {
      const side = () => {
        const g = el('div', 'qb-bars');
        g.setAttribute('aria-hidden', 'true');
        [18, 30, 44, 26, 38, 48, 22, 34, 46, 28, 40, 20, 32, 16].forEach((h, i) => {
          const b = el('span', 'qb-bar');
          b.style.height = h + 'px';
          b.style.animationDelay = i * 0.07 + 's';
          g.append(b);
          this.bars.push(b);
        });
        return g;
      };
      this.recBtn = btn('qb-recbtn', '', () => this.toggleKeyboard());
      this.toolbar.append(side(), this.recBtn, side());
      this.updateRec();
    } else if (this.mode === 'photo') {
      const has = !!n.imageIds?.length;
      const lib = btn('qb-pbtn', `${icon('library', 20)}<span>Library</span>`, () => this.host.pickPhotos(n.id, false));
      const shutter = btn('qb-shutter', '<span></span>', () => this.host.pickPhotos(n.id, true), 'Take photo');
      const retake = btn('qb-pbtn', `${icon('retake', 20)}<span>Retake</span>`, () => {
        if (n.imageIds?.length) this.host.pickPhotos(n.id, true, n.imageIds[0]);
      });
      retake.disabled = !has;
      this.toolbar.append(lib, shutter, retake);
    }
  }

  private setTool(t: Tool) {
    this.clearSelection();
    store.setSettings({ tool: t });
  }

  // ---- speak -------------------------------------------------------------------------

  private startSpeak() {
    const n = this.note!;
    if (this.textarea) return;
    const ta = el('textarea', 'qb-speak');
    ta.setAttribute('autocapitalize', 'sentences');
    ta.setAttribute('autocorrect', 'on');
    ta.setAttribute('spellcheck', 'true');
    ta.setAttribute('enterkeyhint', 'done');
    ta.setAttribute('aria-label', 'Note text');
    ta.placeholder = 'Tap the mic key on the keyboard and speak…';
    ta.value = n.text ?? '';
    ta.addEventListener('input', () => {
      if (this.noteId) setText(this.noteId, ta.value, this.textKey);
      this.pulseBars();
    });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        ta.blur();
      }
    });
    ta.addEventListener('focus', () => this.updateRec());
    ta.addEventListener('blur', () => {
      if (this.noteId) setText(this.noteId, ta.value, this.textKey);
      this.updateRec();
    });
    this.canvasWrap.append(ta);
    this.textarea = ta;
    this.positionOverlays();
    // Synchronous focus: iPadOS opens the keyboard only inside the tap that got us here.
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }

  /** The big round button: opens the keyboard (tap its mic key) or finishes. */
  private toggleKeyboard() {
    const ta = this.textarea;
    if (!ta) return;
    if (document.activeElement === ta) ta.blur();
    else ta.focus({ preventScroll: true });
  }

  private updateRec() {
    const b = this.recBtn;
    if (!b) return;
    const active = !!this.textarea && document.activeElement === this.textarea;
    b.classList.toggle('qb-rec', active);
    b.innerHTML = active ? '<span class="qb-rec-stop"></span>' : icon('mic', 30, '#FFFFFF', 2.4);
    b.setAttribute('aria-label', active ? 'Done speaking' : 'Open the keyboard to dictate');
  }

  /** The sound bars move while text is arriving (driven by typing/dictation, not audio). */
  private pulseBars() {
    for (const b of this.bars) b.classList.add('active');
    clearTimeout(this.barsTimer);
    this.barsTimer = window.setTimeout(() => this.bars.forEach((b) => b.classList.remove('active')), 700);
  }

  // ---- rail ----------------------------------------------------------------------------

  private renderRail(n: Note) {
    this.rail.replaceChildren(...(this.mode === 'view' ? this.viewRail(n) : this.writeRail(n)));
  }

  private group(label: string, ...children: HTMLElement[]) {
    const g = el('div', 'qb-rail-group');
    g.append(el('span', 'qb-rail-label', label), ...children);
    return g;
  }

  private writeRail(n: Note): HTMLElement[] {
    const pri = el('div', 'qb-grid2');
    for (const p of PRIORITIES) {
      const s = PRIORITY[p];
      const on = n.priority === p;
      const b = btn(
        'qb-pri' + (on ? ' on' : ''),
        `<span class="qb-pri-name"><span class="qb-swatch" style="background:${s.grad}"></span>${s.label}</span><span class="qb-pri-xp">+${s.xp}</span>`,
        () => setPriority(n.id, p),
      );
      b.setAttribute('aria-pressed', String(on));
      pri.append(b);
    }

    const due = el('div', 'qb-grid3');
    for (const [zone, label] of [
      ['today', 'Today'],
      ['week', 'This Week'],
      ['someday', 'Someday'],
    ] as [ZoneId, string][]) {
      const on = n.zone === zone;
      const b = btn('qb-opt' + (on ? ' on' : ''), label, () => {
        if (n.zone !== zone) moveNote(n.id, { zone });
      });
      b.setAttribute('aria-pressed', String(on));
      due.append(b);
    }
    const dueGroup = this.group('Due', due);
    if (n.zone === 'week') {
      const days = el('div', 'qb-days');
      for (const d of WEEKDAYS) {
        const on = n.due === d;
        const b = btn('qb-day' + (on ? ' on' : ''), WEEKDAY_LABEL[d].slice(0, 2), () =>
          moveNote(n.id, { due: on ? null : (d as Weekday) }),
        );
        b.setAttribute('aria-pressed', String(on));
        b.setAttribute('aria-label', WEEKDAY_LABEL[d]);
        days.append(b);
      }
      dueGroup.append(days);
    }

    const board = el('div', 'qb-grid2');
    for (const b of BOARDS) {
      const on = n.board === b;
      const x = btn('qb-opt' + (on ? ' on board' : ''), BOARD_LABEL[b], () => {
        if (n.board !== b) moveNote(n.id, { board: b });
      });
      x.setAttribute('aria-pressed', String(on));
      board.append(x);
    }

    const reward = el('div', 'qb-reward');
    reward.append(el('span', 'qb-reward-label', 'Reward on complete'), el('span', 'qb-reward-xp', `+${PRIORITY[n.priority].xp} XP`));

    const ctas = el('div', 'qb-ctas');
    ctas.append(
      btn('qb-cta qb-skew8', `<span>${icon('check', 22, '#0A1430', 3)}${this.isNew ? 'Add to Board' : 'Done'}</span>`, () => this.close()),
      btn('qb-ghostbtn', this.isNew ? 'Discard' : 'Delete note', () => {
        const id = n.id;
        if (isEmpty(store.get(id))) {
          this.close();
          return;
        }
        this.close();
        this.host.deleteNote(id);
      }),
    );
    return [this.group('Priority', pri), dueGroup, this.group('Board', board), reward, ctas];
  }

  private viewRail(n: Note): HTMLElement[] {
    const head = el('div', 'qb-rail-head');
    const t = el('div', 'qb-col-title');
    const eyebrow = n.zone === 'today' ? 'Daily Quest' : n.zone === 'week' ? 'Weekly Challenge' : 'Backlog';
    t.append(el('span', 'qb-eyebrow', eyebrow), el('h2', 'qb-display qb-h3', 'Note Info'));
    head.append(t, btn('qb-skew qb-iconbtn', `<span>${icon('close', 22, '#FFFFFF', 2.4)}</span>`, () => this.close(), 'Close'));

    const rows = el('dl', 'qb-details');
    const row = (k: string, v: string, cls = '') => {
      const r = el('div', 'qb-detail');
      r.append(el('dt', '', k), el('dd', cls, v));
      rows.append(r);
    };
    row('Status', n.status === 'done' ? 'Complete' : 'Active', n.status === 'done' ? 'yellow' : 'green');
    row('Due', dueLong(n));
    const age = n.status === 'active' ? daysInToday(n) : 0;
    if (age >= 1) row('In Today', `Day ${age + 1}`, age >= 2 ? 'orange' : '');
    row('Created', new Date(n.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }));
    row('Board', BOARD_LABEL[n.board]);
    const photos = n.imageIds?.length ?? 0;
    row('Attached', photos ? `${photos} photo${photos > 1 ? 's' : ''}` : '—');
    if (n.reminder) row('Reminder', formatDue(n.reminder.due));

    const acts = el('div', 'qb-actions');
    const moveTo: ZoneId = n.zone === 'today' ? 'week' : 'today';
    acts.append(
      btn('qb-act', `${icon('edit', 22)}<span>Edit</span>`, () => this.setMode(hasText(n) && !n.strokes.length ? 'speak' : 'write', true)),
      btn('qb-act', `${icon('move', 22)}<span>Move to ${moveTo === 'today' ? 'Today' : 'This Week'}</span>`, () => moveNote(n.id, { zone: moveTo })),
      btn('qb-act', `${icon('bell', 22)}<span>${n.reminder ? 'Reminder' : 'Remind me'}</span>`, () => this.host.remind(n.id)),
      btn('qb-act danger', `${icon('trash', 22)}<span>Delete</span>`, () => {
        const id = n.id;
        this.close();
        this.host.deleteNote(id);
      }),
    );

    const ctas = el('div', 'qb-ctas');
    const xp = PRIORITY[n.priority].xp;
    if (n.status === 'done') {
      const sent = el('div', 'qb-sent');
      sent.innerHTML = `<span>${icon('check', 20, '#FFE14D', 3)}Sent to Vault</span><span class="qb-reward-xp">+${n.xp ?? xp} XP</span>`;
      ctas.append(sent, btn('qb-ghostbtn', 'Undo complete', () => this.host.uncomplete(n.id)));
    } else {
      ctas.append(
        btn('qb-cta qb-skew8', `<span>${icon('check', 22, '#0A1430', 3)}Complete · +${xp} XP</span>`, (e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          this.host.complete(n.id, r);
        }),
      );
    }
    return [head, rows, acts, ctas];
  }

  // ===========================================================================
  // page rendering

  /** Canvas size, measured on demand so input never waits for the ResizeObserver. */
  private size() {
    if (!this.w || !this.h) {
      const r = this.canvasWrap.getBoundingClientRect();
      this.w = r.width;
      this.h = r.height;
    }
    return { w: this.w, h: this.h };
  }

  private transform() {
    return pageTransform(this.note!, { ...this.size(), fit: 'page' });
  }

  private renderPage = () => {
    const n = this.note;
    if (!n || !this.wrap) return;
    this.size();
    if (!this.w || !this.h) return;
    cancelAnimationFrame(this.frameReq);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const pw = Math.round(this.w * dpr);
    const ph = Math.round(this.h * dpr);
    for (const c of [this.page, this.live]) {
      if (c.width !== pw || c.height !== ph) {
        c.width = pw;
        c.height = ph;
      }
    }
    const offset =
      this.selection && this.selDrag
        ? { indices: new Set(this.selection.indices), dx: this.selDrag.dx, dy: this.selDrag.dy }
        : undefined;
    drawPage(this.page.getContext('2d')!, n, {
      w: this.w,
      h: this.h,
      dpr,
      fit: 'page',
      photo: 'full',
      hideText: this.mode === 'speak',
      skip: this.eraser?.hits,
      offset,
      onAsset: () => {
        this.frameReq = requestAnimationFrame(() => this.renderPage());
      },
    });
  };

  /** Text field, empty-photo placeholder, expand button and lasso box sit over the canvas. */
  private positionOverlays() {
    const n = this.note;
    if (!n || !this.wrap) return;
    this.size();
    if (!this.w) return;
    const { k, tx, ty } = this.transform();
    if (this.textarea) {
      // Sit exactly where the page lays the text out (under the photo, if any).
      const b = textBox(!!n.imageIds?.length);
      Object.assign(this.textarea.style, {
        inset: 'auto',
        left: tx + b.x * k + 'px',
        top: ty + b.y * k + 'px',
        width: b.w * k + 'px',
        height: b.h * k + 'px',
        fontSize: Math.max(24, Math.min(54, (n.imageIds?.length ? 56 : 72) * k)) + 'px',
        padding: '8px',
      });
    }
    const wantEmpty = this.mode === 'photo' && !n.imageIds?.length;
    if (wantEmpty && !this.emptyPhoto) {
      this.emptyPhoto = el('div', 'qb-emptyphoto');
      this.emptyPhoto.innerHTML = `<div class="qb-emptyphoto-tape"></div><div class="qb-emptyphoto-in">${icon('library', 44, '#B9C8EA', 1.8)}<span>Your photo</span></div>`;
      this.canvasWrap.append(this.emptyPhoto);
    } else if (!wantEmpty && this.emptyPhoto) {
      this.emptyPhoto.remove();
      this.emptyPhoto = null;
    }
    const wantExpand = (this.mode === 'view' || this.mode === 'photo') && !!n.imageIds?.length;
    if (wantExpand && !this.expandBtn) {
      this.expandBtn = btn('qb-expand', icon('expand', 22, '#FFFFFF', 2.4), () => this.host.openViewer(n.id, 0), 'Open photo full screen');
      this.canvasWrap.append(this.expandBtn);
    } else if (!wantExpand && this.expandBtn) {
      this.expandBtn.remove();
      this.expandBtn = null;
    }
    this.positionLassoBox();
  }

  // ===========================================================================
  // input on the canvas

  private toPage(cx: number, cy: number) {
    const r = this.canvasWrap.getBoundingClientRect();
    const { k, tx, ty } = this.transform();
    return { x: (cx - r.left - tx) / k, y: (cy - r.top - ty) / k };
  }

  private canWrite() {
    return this.mode === 'write' || this.mode === 'photo';
  }

  private onDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('textarea, button')) return;
    const n = this.note;
    if (!n) return;
    e.preventDefault();
    const isPen = e.pointerType === 'pen' || e.pointerType === 'mouse';

    if (e.pointerType === 'touch') {
      if (this.cap.active) return; // palm
      this.touches.set(e.pointerId, { sx: e.clientX, sy: e.clientY, t0: performance.now() });
      if (this.touches.size === 2) {
        const first = [...this.touches.values()][0];
        this.twoTap = { t0: first.t0, ok: performance.now() - first.t0 < 260 };
        this.selDrag = null;
        return;
      }
      // One finger may drag a lasso selection.
      const p = this.toPage(e.clientX, e.clientY);
      if (this.selection && this.inSelection(p.x, p.y)) this.beginSelDrag(e);
      return;
    }
    if (!isPen) return;
    this.capture(e);

    if (this.mode === 'view') {
      this.setMode('write'); // the Pencil only writes: lift it to the editor
      return;
    }
    if (this.mode === 'speak') return;
    const p = this.toPage(e.clientX, e.clientY);
    const tool = store.settings.tool;
    if (tool === 'eraser') {
      this.eraser = { pointerId: e.pointerId, hits: new Set() };
      this.eraseAt(p.x, p.y);
      return;
    }
    if (tool === 'lasso') {
      if (this.selection && this.inSelection(p.x, p.y)) {
        this.beginSelDrag(e);
        return;
      }
      this.clearSelection();
      this.lasso = { pointerId: e.pointerId, points: [[p.x, p.y]] };
      return;
    }
    this.clearSelection();
    const highlighter = tool === 'highlighter';
    this.cap.begin(
      e,
      {
        toLocal: (cx, cy) => this.toPage(cx, cy),
        drawLive: (pts, color, size, tilt, sim) => this.drawLive(pts, color, size, tilt, sim, highlighter ? 'highlighter' : 'pen'),
        endLive: () => this.clearLive(),
      },
      store.settings.inkColor,
      highlighter ? HIGHLIGHTER_SIZE : PEN_SIZE,
    );
    this.capTool = highlighter ? 'highlighter' : 'pen';
  };

  private capTool: 'pen' | 'highlighter' = 'pen';

  private capture(e: PointerEvent) {
    try {
      this.canvasWrap.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic */
    }
  }

  private onMove = (e: PointerEvent) => {
    if (e.pointerType === 'pen') this.moveRing(e);
    if (this.cap.isPointer(e.pointerId)) {
      this.cap.move(e);
      return;
    }
    if (this.eraser?.pointerId === e.pointerId) {
      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      for (const ce of events.length ? events : [e]) {
        const p = this.toPage(ce.clientX, ce.clientY);
        this.eraseAt(p.x, p.y);
      }
      return;
    }
    if (this.lasso?.pointerId === e.pointerId) {
      const p = this.toPage(e.clientX, e.clientY);
      this.lasso.points.push([p.x, p.y]);
      this.drawLasso();
      return;
    }
    if (this.selDrag?.pointerId === e.pointerId) {
      const p = this.toPage(e.clientX, e.clientY);
      this.selDrag.dx = p.x - this.selDrag.sx;
      this.selDrag.dy = p.y - this.selDrag.sy;
      this.renderPage();
      this.positionLassoBox();
      return;
    }
    const t = this.touches.get(e.pointerId);
    if (this.twoTap && t && Math.hypot(e.clientX - t.sx, e.clientY - t.sy) > 14) this.twoTap.ok = false;
  };

  private onUp = (e: PointerEvent) => {
    if (this.cap.isPointer(e.pointerId)) {
      this.cap.move(e);
      this.commitStroke();
      return;
    }
    if (this.eraser?.pointerId === e.pointerId) {
      const hits = [...this.eraser.hits];
      this.eraser = null;
      if (hits.length && this.noteId) eraseStrokes(this.noteId, hits);
      else this.renderPage();
      return;
    }
    if (this.lasso?.pointerId === e.pointerId) {
      this.finishLasso();
      return;
    }
    if (this.selDrag?.pointerId === e.pointerId) {
      this.finishSelDrag();
      return;
    }
    const t = this.touches.get(e.pointerId);
    if (!t) return;
    this.touches.delete(e.pointerId);
    if (this.twoTap) {
      if (this.touches.size === 0) {
        const ok = this.twoTap.ok && performance.now() - this.twoTap.t0 < 380;
        this.twoTap = null;
        if (ok) this.host.undo();
      }
      return;
    }
    // Finger tap on the photo opens it.
    const quick = performance.now() - t.t0 < 400 && Math.hypot(e.clientX - t.sx, e.clientY - t.sy) < 12;
    const n = this.note;
    if (quick && n) {
      const p = this.toPage(e.clientX, e.clientY);
      if (hitPhoto(n, p.x, p.y)) this.host.openViewer(n.id, 0);
    }
  };

  private onCancel = (e: PointerEvent) => {
    if (this.cap.isPointer(e.pointerId)) this.commitStroke(); // never lose ink
    if (this.eraser?.pointerId === e.pointerId) this.onUp(e);
    if (this.lasso?.pointerId === e.pointerId) {
      this.lasso = null;
      this.clearLive();
    }
    if (this.selDrag?.pointerId === e.pointerId) this.finishSelDrag();
    this.touches.delete(e.pointerId);
    this.twoTap = null;
  };

  private moveRing(e: PointerEvent) {
    if (!this.canWrite()) {
      this.ring.hidden = true;
      return;
    }
    const r = this.canvasWrap.getBoundingClientRect();
    this.ring.hidden = false;
    this.ring.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`;
  }

  // ---- strokes -------------------------------------------------------------------------

  private drawLive(points: InkPoint[], color: string, size: number, tilt: number, simulate: boolean, tool: 'pen' | 'highlighter') {
    const ctx = this.live.getContext('2d')!;
    const dpr = this.live.width / (this.w || 1);
    const { k, tx, ty } = this.transform();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.live.width, this.live.height);
    ctx.setTransform(k * dpr, 0, 0, k * dpr, tx * dpr, ty * dpr);
    ctx.globalAlpha = strokeAlpha(tilt, tool);
    ctx.fillStyle = color;
    ctx.fill(pathFor(points, size, tilt, false, simulate, tool));
    ctx.globalAlpha = 1;
  }

  private clearLive() {
    const ctx = this.live.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.live.width, this.live.height);
  }

  private commitStroke() {
    const res = this.cap.end();
    const id = this.noteId;
    if (!res || !id) return;
    const stroke: Stroke = this.capTool === 'highlighter' ? { ...res.stroke, tool: 'highlighter', tilt: 0 } : res.stroke;
    if (this.capTool === 'pen') {
      const crossed = scribbleTargets(store.get(id)!, stroke);
      if (crossed.length) {
        eraseStrokes(id, crossed); // scribbled out: erase what it covered, keep no scribble
        return;
      }
    }
    addStroke(id, stroke);
  }

  private eraseAt(x: number, y: number) {
    const n = this.note;
    if (!n || !this.eraser) return;
    const { k } = this.transform();
    const r = Math.max(14, 16 / k);
    let changed = false;
    n.strokes.forEach((s, i) => {
      if (this.eraser!.hits.has(i)) return;
      const rr = r + s.size / 2;
      if (s.points.some(([px, py]) => (px - x) ** 2 + (py - y) ** 2 < rr * rr)) {
        this.eraser!.hits.add(i);
        changed = true;
      }
    });
    if (changed) this.renderPage();
  }

  // ---- lasso ------------------------------------------------------------------------------

  private drawLasso() {
    const l = this.lasso;
    if (!l) return;
    const ctx = this.live.getContext('2d')!;
    const dpr = this.live.width / (this.w || 1);
    const { k, tx, ty } = this.transform();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.live.width, this.live.height);
    ctx.setTransform(k * dpr, 0, 0, k * dpr, tx * dpr, ty * dpr);
    ctx.beginPath();
    l.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = '#3BE0FF';
    ctx.lineWidth = 3 / k;
    ctx.setLineDash([10 / k, 8 / k]);
    ctx.stroke();
  }

  private finishLasso() {
    const l = this.lasso!;
    this.lasso = null;
    this.clearLive();
    const n = this.note;
    if (!n || l.points.length < 6) return;
    const poly = l.points;
    const indices: number[] = [];
    n.strokes.forEach((s, i) => {
      const inside = s.points.filter(([x, y]) => pointInPolygon(x, y, poly)).length;
      if (inside >= s.points.length * 0.6) indices.push(i);
    });
    if (!indices.length) return;
    this.selection = { indices, strokes: n.strokes };
    this.positionLassoBox();
  }

  private selectionBounds() {
    const n = this.note;
    if (!n || !this.selection) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const i of this.selection.indices) {
      const s = n.strokes[i];
      if (!s) continue;
      for (const [x, y] of s.points) {
        x0 = Math.min(x0, x - s.size);
        y0 = Math.min(y0, y - s.size);
        x1 = Math.max(x1, x + s.size);
        y1 = Math.max(y1, y + s.size);
      }
    }
    if (x0 === Infinity) return null;
    const dx = this.selDrag?.dx ?? 0;
    const dy = this.selDrag?.dy ?? 0;
    return { x: x0 + dx - 10, y: y0 + dy - 10, w: x1 - x0 + 20, h: y1 - y0 + 20 };
  }

  private inSelection(x: number, y: number) {
    const b = this.selectionBounds();
    return !!b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  }

  private beginSelDrag(e: PointerEvent) {
    const p = this.toPage(e.clientX, e.clientY);
    this.capture(e);
    this.selDrag = { pointerId: e.pointerId, sx: p.x, sy: p.y, dx: 0, dy: 0 };
  }

  private finishSelDrag() {
    const d = this.selDrag;
    const sel = this.selection;
    this.selDrag = null;
    if (!d || !sel || !this.noteId) return;
    if (Math.abs(d.dx) < 1 && Math.abs(d.dy) < 1) {
      this.renderPage();
      this.positionLassoBox();
      return;
    }
    const indices = sel.indices;
    moveStrokes(this.noteId, indices, d.dx, d.dy);
    // Keep the moved strokes selected.
    this.selection = { indices, strokes: this.note!.strokes };
    this.positionLassoBox();
  }

  private positionLassoBox() {
    const b = this.selectionBounds();
    if (!b || (this.mode !== 'write' && this.mode !== 'photo')) {
      this.lassoBox?.remove();
      this.lassoBox = null;
      return;
    }
    if (!this.lassoBox) {
      this.lassoBox = el('div', 'qb-lassobox');
      const del = btn('qb-lassodel', icon('trash', 18, '#FFFFFF', 2.4), () => {
        const sel = this.selection;
        this.clearSelection();
        if (sel && this.noteId) eraseStrokes(this.noteId, sel.indices);
      }, 'Delete selection');
      this.lassoBox.append(del);
      this.canvasWrap.append(this.lassoBox);
    }
    const { k, tx, ty } = this.transform();
    Object.assign(this.lassoBox.style, {
      left: tx + b.x * k + 'px',
      top: ty + b.y * k + 'px',
      width: b.w * k + 'px',
      height: b.h * k + 'px',
    });
  }

  private clearSelection() {
    this.selection = null;
    this.selDrag = null;
    this.lassoBox?.remove();
    this.lassoBox = null;
  }
}

// ---- geometry helpers ------------------------------------------------------------------------

function pointInPolygon(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Scribble-to-erase: a quick, dense zig-zag that crosses existing strokes erases them.
 * Returns the indices it covers (empty = it's just ink).
 */
export function scribbleTargets(n: Note, s: Stroke): number[] {
  const pts = s.points;
  if (pts.length < 12 || !n.strokes.length) return [];
  let len = 0;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
    if (i) len += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]);
  }
  const w = x1 - x0;
  const h = y1 - y0;
  const diag = Math.hypot(w, h);
  if (diag < 30 || len / diag < 3.2) return [];
  // Count direction reversals along the scribble's long axis.
  const axis = w >= h ? 0 : 1;
  let reversals = 0;
  let dir = 0;
  let anchor = pts[0][axis];
  for (const p of pts) {
    const d = p[axis] - anchor;
    if (Math.abs(d) < 8) continue;
    const nd = Math.sign(d);
    if (dir && nd !== dir) reversals++;
    dir = nd;
    anchor = p[axis];
  }
  if (reversals < 4) return [];
  const pad = 12;
  const hits: number[] = [];
  n.strokes.forEach((t, i) => {
    const inside = t.points.filter(([x, y]) => x >= x0 - pad && x <= x1 + pad && y >= y0 - pad && y <= y1 + pad).length;
    if (inside >= t.points.length * 0.5) hits.push(i);
  });
  return hits;
}
