# Quest Board — design spec

A sticky-note to-do board for iPad, styled like a battle-royale game lobby. One handwritten task per note; completing a note earns XP and makes the player's hero, **Nova**, celebrate.

Target: iPad landscape, designed at **1194 × 834** (11" iPad). Every hit target is at least **44 px**. Colours, fonts, shapes and animations are in `tokens.css`.

---

## 1. Look

| Element | Rule |
|---|---|
| Background | Deep navy gradient with a soft blue glow from the top centre, plus faint 135° stripes (`--qb-bg`, `--qb-stripes`). |
| Panels | Translucent navy (`--qb-panel`) with a thin blue border and the **top-right corner cut** (`.qb-cut`). |
| Controls | Tabs, chips and icon buttons are **slanted** −12° (`.qb-skew`); the label inside is un-skewed. |
| Headings | Barlow Condensed 900 italic, uppercase, hard 3 px drop shadow (`.qb-display`). An eyebrow line sits above each (`.qb-eyebrow`). |
| Body | Barlow 500–600. |
| Handwriting | Caveat 600 stands in for Pencil ink in the mockups. In the real app this is the user's own strokes. |
| Selection | Yellow `--qb-accent` fill with navy text, or a 2 px yellow ring. |
| Primary button | Yellow, slanted −8°, 6 px darker-yellow lip underneath (`.qb-cta`). |
| Icons | Inline stroke SVG, 2–2.4 px stroke, round caps. No emoji. |

### Priority → colour → XP

Priority is the note's coloured frame (4–5 px gradient border around the dark note).

| Priority | Frame | Label colour | XP |
|---|---|---|---|
| Low | `--qb-low` (green) | `--qb-low-light` | 25 |
| Normal | `--qb-normal` (blue) | `--qb-normal-light` | 50 |
| High | `--qb-high` (purple) | `--qb-high-light` | 100 |
| Urgent | `--qb-urgent` (orange) | `--qb-urgent-light` | 150 |

The sample notes on the board use other XP values; treat the table above as the rule.

### Levels
1000 XP per level. The XP bar is segmented (a tick every 25 px) and fills with a cyan → blue gradient.

---

## 2. Screens

Source for each is in `screens/` (see README for how to read the format).

### 2.1 Board — `Main.dc.html`

**Top bar (84 px tall, 24 px side padding)**, left to right:
1. **Work / Personal** tabs: slanted, 48 px tall; the active one is yellow.
2. **Level**: hex badge (54 px, purple gradient) with the level number, then "LEVEL n" and "xxx / 1000 XP" above the segmented bar (250 px wide).
3. **Streak**: slanted orange-tinted chip with a flame icon, the day count, and "DAY STREAK" on two lines.
4. *(spacer)*
5. **Vault**: slanted yellow-tinted chip with a chest icon and the count of completed notes.
6. **Undo** (reverses the last complete / un-complete), then **Settings**: 48 px slanted icon buttons.

**Body**: three columns in a grid, `1.25fr 1fr 260px`, 18 px gap.

- **Today** ("DAILY QUESTS"): a 2 × 2 grid of large note cards. The last cell is a dashed "+ NEW NOTE" tile. The header's right side shows "n / m COMPLETE" and "RESETS IN 9H 12M".
- **This Week** ("WEEKLY CHALLENGES"): a 2 × 3 grid of smaller cards, with "+ NEW NOTE" last. Each card shows its due weekday in a chip tinted with its priority colour. The header's right side shows "n / m COMPLETE" and the date range.
- **Hero** ("YOUR HERO", name "NOVA"): Nova stands on a glowing oval stand under a soft light beam. Below her is a status line ("READY FOR ACTION", which becomes "QUEST COMPLETE!" in yellow while she celebrates), then **Locker** and **Emotes** buttons. Emotes plays the celebration as a preview.

**Note card**: priority gradient frame, then a dark dotted surface (`--qb-card-ink` + `--qb-card-dots`). Top row: priority name in its label colour, "+XP" in yellow. The handwriting sits centred, tilted −2°.
- Today cards: handwriting at 33 px.
- Week cards: handwriting at 26 px, with the day chip at the top and priority + XP in the footer.

**Completed card**: a dark overlay and a yellow "✓ COMPLETE" stamp rotated −8°.

**Interactions**
- Tap a card → toggle complete. On completing: add XP (the level rolls over at 1000), add 1 to the Vault, record the change for Undo, trigger the hero celebration (§3.3).
- Tap "+ NEW NOTE" → open the Write sheet.
- Recommended for the real build: **tap = open the note (View)**, and swipe or press-and-hold = complete. The mockup uses tap-to-complete for simplicity.

### 2.2 Write a note — `Write.dc.html`

This sheet opens over the board, which stays visible behind it blurred 6 px with a `--qb-scrim` overlay.

**Left: the note (680 × 738).** Priority frame, dotted surface. The header has a yellow "NEW NOTE" tag, "PRIORITY · DUE" in the priority colour, and the XP.

**Input tabs** (slanted): **Write · Speak · Photo**.

| Mode | Canvas | Bottom bar |
|---|---|---|
| Write | Pencil ink. A glowing cyan ring marks where the pen tip is. Hint: "ONE TASK PER NOTE · SCRIBBLE OUT TO ERASE". | Pen, Highlighter, Eraser, Lasso · ink colours white / yellow / cyan / pink · undo / redo stroke |
| Speak | Live transcript in Barlow 600, 50 px. Words not yet confirmed are dimmed; a blinking cyan caret follows the text. Above it, red "● LISTENING · 0:04". Hint: "TAP ANY WORD TO FIX IT WITH THE PEN". | Red 68 px stop button with a pulsing ring, moving cyan sound bars on both sides |
| Photo | The photo shown as a tilted, taped polaroid, with a handwritten caption below it | Library · 68 px white shutter · Retake |

**Right: settings rail.**
- **Priority**: 2 × 2 buttons, each with a colour swatch, name and XP.
- **Due**: Today / This Week. This Week reveals a row of seven day buttons (Mo–Su).
- **Board**: Work / Personal.
- **Reward**: "REWARD ON COMPLETE +XP" box.
- **Buttons**: **ADD TO BOARD** (primary CTA) and **DISCARD**.

Changing priority immediately recolours the frame and updates the XP everywhere on the sheet.

### 2.3 View a note — `View.dc.html`

Same sheet layout as Write.

- **Left**: the note, read-only. Header shows the priority tag, "WORK · DUE FRI" and the XP. The photo is large (520 × 330), with an expand button that opens it full screen. The handwriting sits below it at 64 px.
- **Right**:
  - **Header**: "WEEKLY CHALLENGE" eyebrow, "NOTE INFO" title, and a close (×) button.
  - **Detail rows**: Status (Active in green, Complete in yellow), Due, Created, Board, Attached (n photos).
  - **Actions**: three tiles, Edit (goes to Write), Move to Today, and Delete (red tint).
  - **Main button**: **COMPLETE · +XP**. Once completed, it changes to a "SENT TO VAULT +XP" box plus an **UNDO COMPLETE** button, and the note gets the Complete stamp.

### 2.4 Locker — `Locker.dc.html`

Fully specified in **`AVATAR.md` §4**: 33 outfits with style filters, a 5-tab style panel (Colors · Hair · Extras · Skin · Emotes), level locks and Equip.

---

## 3. Nova (hero avatar) and emotes

Fully specified in **`AVATAR.md`**: how she is built in layers, the 33-outfit wardrobe including four sarees, 8 hairstyles, 13 accessories, skin and hair colours, and the 20 emotes (in `emotes.css`).

On the board, the hero column (§2.1) shows Nova at 1.25× and has an **Emotes** button. It opens an emote list over the stage; tapping one plays it. Completing a quest plays the player's ★ victory emote together with the confetti, ring and XP pop.

---

## 4. Suggested data model

```ts
type Board = 'work' | 'personal';
type Priority = 'low' | 'normal' | 'high' | 'urgent';
type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

interface Note {
  id: string;
  board: Board;
  bucket: 'today' | 'week';
  due?: Weekday;                // when bucket === 'week'
  priority: Priority;           // XP comes from the priority table
  ink?: InkStroke[];            // Pencil strokes (Write)
  text?: string;                // dictated text (Speak)
  photoIds?: string[];          // blobs in IndexedDB (Photo)
  createdAt: number;
  completedAt?: number;
}

interface InkStroke { color: string; tool: 'pen' | 'highlighter'; points: [x: number, y: number, pressure: number][]; }

interface Player {
  xp: number;                   // level = floor(xp / 1000) + 1
  streakDays: number;
  vaultCount: number;
  outfit: OutfitId;             // see AVATAR.md §2 (33 ids)
  outfitColors: Record<OutfitId, { p?: string; s?: string; a?: string }>;  // overrides of the defaults
  hairStyle: 'braid' | 'ponytail' | 'bun' | 'bob' | 'long' | 'curly' | 'pixie' | 'spacebuns';
  hair: string;
  skin: string;
  accessories: AccessoryId[];   // see AVATAR.md §3
  victoryEmote: EmoteId;        // see AVATAR.md §5
}
```

## 5. Browser APIs the design implies

| Feature | API |
|---|---|
| Pencil writing | Pointer Events (`pointerType === 'pen'`, `pressure`) drawn on a `<canvas>`. Ignore finger touches while drawing so the palm doesn't draw. |
| Scribble-to-erase | Detect a dense zig-zag stroke that crosses existing strokes; remove what it crosses. |
| Speak | `SpeechRecognition` / `webkitSpeechRecognition` with `interimResults: true`. Show interim words dimmed and final words in full white. |
| Photo | `<input type="file" accept="image/*" capture="environment">` is simplest on iPad. Store the image as a `Blob` in IndexedDB and display it via `URL.createObjectURL`. |
| Offline | Everything is local: IndexedDB for notes, photos and player state. |
