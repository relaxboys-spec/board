# Quest Board

A handwritten sticky-note board for iPad and Apple Pencil, installed to the Home Screen as a web app.
Tap the Pencil anywhere and a note appears. Write on it, and it’s saved. No typing, titles, folders or
save button.

Everything stays on the iPad, in IndexedDB. There’s no server, no analytics and no network requests
for data. The whole app works offline once it’s installed.

The look follows the design handoff in [`design/quest-board/`](design/quest-board/README.md): a game-lobby
board with **Today** (daily quests), **This Week** (weekly challenges), a **Backlog** drawer for someday
notes, and **Nova**, a hero who celebrates every finished note.

## How it works (cheat sheet)

| You do… | With | What happens |
|---|---|---|
| Tap **+ New Task**, or empty space in a column | Pencil / finger | New note in that column, opened big for writing |
| Tap the 🎤 or 📷 on a + New Task tile | Finger | New note straight into **Speak** (keyboard up) or **Photo** (picker open) |
| Touch a note | Pencil | Opens it for writing |
| Tap a note | Finger | Opens it: note info, actions, **Complete** |
| Hold a note still | Finger | It lifts, a yellow bar fills, and it's **complete** |
| Hold a note, then move (or swipe it sideways) | Finger | Drag it: to the other column, the other board's tab, the Backlog, or the Vault / hero (= complete) |
| Swipe up and down in a column | Finger | Scroll |
| Tap with two fingers | Fingers | Undo (also the ↶ button) |
| Hover over a note (supported iPads) | Pencil | The note lights up cyan |

**In a note:** **Write**, **Speak** and **Photo** tabs; the side rail sets **priority**, **due**
(Today / This Week + day / Someday) and **board**. Changes save as you make them; **Add to Board** just
closes it. An untouched empty note disappears on its own.

**Writing tools:** pen, highlighter, eraser, lasso (circle strokes, then drag them, or tap the red
trash), four inks, undo / redo. **Scribble out** a word (a quick zig-zag over it) to erase it.

**Priority = colour = XP:** Low (green, 25), Normal (blue, 50), High (purple, 100), Urgent (orange, 150).
Level 1 needs 300 XP, each level after that 100 more, up to 1000 XP per level from Level 8 on (so the first
rewards come in a day or two). The streak counts days with at least one finished note.

**Each day** (checked when the app opens, at midnight, when she comes back to it, and when a note is
closed):

- **Completed notes** stay on the board with a yellow **COMPLETE** stamp until midnight ("Resets in…"),
  then move to the **Vault** (top bar), grouped by day, where you can **Put back** any of them.
- **Unfinished Today notes stay put.** From their second day they show a small **Day 2**, **Day 3**…
  chip, orange from day 3, so she can see what's carrying over. Nothing moves or disappears on its own.
- **This Week notes with a day move into Today on that day**, at the front. A day picked always means
  the next time it comes round (a Wed picked on a Thursday is next week's, and its chip says
  **Next Wed**). If the app wasn't opened that day, they arrive next time, aged from their day.
- **This Week notes without a day** stay in This Week until she moves them.

**Nova and the Locker:** tap **Locker** under Nova (or the hero chip in portrait). There are 33 outfits
in six categories (Casual, Street, Work, Active, Evening, Traditional — including four sarees). Tap a card to
preview, **Equip** to wear it. Under it: **Colors** (three slots per outfit,
remembered per outfit), **Hair** (8 styles, 8 colours), **Extras** (13 accessories — a saree offers to
apply jhumkas, bangles, bindi and a bun), **Skin** and **Emotes** (20). At the top of Emotes she picks her
**victory emote** (the one that plays when a quest is completed) from the emotes she has; **Change** under
the preview jumps there. **Emotes** under Nova plays any of them on the board.

**Reward Track (levelling up unlocks things):** she starts with 5 outfits, 2 hairstyles, 3 hair colours,
4 outfit colours, 2 extras, 3 emotes and every skin tone (skin is never locked). Every level up to 30 unlocks
something — usually a new outfit plus a colour, hairstyle, accessory or emote — and every fifth level is a
named milestone (5 Festive Pack: Nivi saree, jhumkas, bindi, Thumkas · 10 Party Night · 15 Nine Yards ·
20 Temple Silk · 25 Varsity Legend · 30 Boss Mode). The full list is in `src/rewards.ts`.
- Completing the quest that reaches a new level opens a **Level up!** reveal: Nova in the new outfit (showing
  off a new emote if there is one), the other rewards, **Wear** it now, or open the Locker.
- New things carry a **NEW** badge (and a count on the Locker button) until she has looked at them.
- Locked things show the level they unlock at. Tapping one **tries it on** in the Locker preview without
  saving; locked emotes can be previewed too.
- Tapping the level in the top bar (or **Reward Track** in the Locker) opens the **Reward Track**: every
  level, what she has, and what's coming.
- Unlocks are never taken back — un-completing a note lowers the XP but not what she has unlocked. When this
  update first runs, anything she is already wearing stays unlocked.

The Pencil only ever writes; fingers only ever move things, so a resting palm can't draw.

---

## Voice notes (dictation)

1. Tap the 🎤 on a **+ New Task** tile (or a note's **Speak** tab). The keyboard comes up straight away.
2. Tap the **microphone key** on the keyboard and speak. The text appears big on the note and is saved
   as it arrives. Tap **done** (or the big red button) to finish.
3. To change it later: open the note → **Edit** → **Speak**. You can also write over any word with the
   Pencil (Scribble), and draw ink on top of the text in **Write**.

The app itself never touches the microphone or any audio. Dictation is the **iPadOS keyboard's**
feature (the bars on the Speak toolbar move when text arrives, not from sound). Whether it's processed
on the iPad or by Apple's servers depends on the iPad model and the dictation language. **To check:**
turn on Airplane Mode and try dictating in Apple Notes. If it works, dictation runs on the device. Turn
it on under **Settings → General → Keyboard → Enable Dictation**.

## Photos

Four ways to add pictures:

1. **📷 on a + New Task tile**, or a note's **Photo** tab: **Library** offers Photo Library, Take Photo or
   Choose File; the big **shutter** button goes straight to the camera; **Retake** replaces the photo.
2. **Drag and drop:** drag pictures from Photos (side by side in Split View or Stage Manager) onto a
   note to add them, or onto a column for a new note there.
3. **Paste:** with a note open, paste adds to it; otherwise paste makes a new note in Today. Without a
   keyboard, long-press inside the Speak text field → Paste.
4. A photo note shows as a taped polaroid; write a caption under it with the Pencil.

Tap a photo (or the expand button) to open it full screen. Pinch to zoom, swipe between a note's
photos, and draw on it with the Pencil (two-finger tap undoes). **Select text** switches the Pencil off
so iPadOS Live Text can select text in the photo; tap **Draw** to go back. **Remove photo** is undoable.

Privacy and size:

- Photos stay **only inside this app** on this iPad. They're never uploaded.
- Each photo is **shrunk** (longest side 2048 px) and re-saved, which **removes all metadata,
  including location**.
- Picking from the library gives the app **only the photos you select**, not your library.
- Photos make **backups bigger**. Export shows the size before saving.

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ locally
npm run icons      # regenerate the PNG icons (original artwork, no dependencies)
node scripts/port-avatar.mjs   # regenerate src/avatarSvg.gen.ts from the design's Avatar.dc.html (+ rig)
```

**Avatar test page:** with `npm run dev` running, open http://localhost:5173/avatar-test.html to see Nova
in all 33 outfits and play each of the 20 emotes on all of them; the Scrub slider freezes a pose, and
`?w=320&only=runner,saree` shows bigger figures for fewer outfits. It is dev-only (not in the build).

On a Mac, the mouse acts like the Pencil (click-drag writes). Scroll pans, and pinch on the trackpad
(or ⌘/Ctrl + scroll) zooms. Finger gestures need a touch screen.

## Testing on a real iPad over your local network

1. Make sure the Mac and iPad are on the same Wi-Fi.
2. Run `npm run dev`. Vite prints a **Network** URL like `http://192.168.1.20:5173`.
3. Open that URL in **Safari on the iPad**. Pencil, gestures, autosave and everything else work.

Things to know:

- **Service workers only run over HTTPS** (or on `localhost`), so offline mode is **not** active over
  the LAN URL. Test offline behaviour on the deployed GitHub Pages site.
- Each address (LAN dev URL vs. GitHub Pages) has **its own separate storage**. Notes written on the dev
  URL won’t appear in the installed app.
- In dev mode the CSP also allows `ws:` so Vite’s hot-reload socket can connect. The production build
  ships the exact policy below.

## Deploying to GitHub Pages

The build uses **relative paths** (`base: './'`), so it works at `https://<user>.github.io/<repo>/`
without any path configuration. A workflow is included.

1. Create a GitHub repository (e.g. `quest-board`) and push this folder to its `main` branch.
2. In the repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Every push to `main` builds and deploys automatically (`.github/workflows/deploy.yml`). The site
   appears at `https://<user>.github.io/<repo>/`.

If you ever need an absolute base path instead, build with `BASE_PATH=/your-path/ npm run build`.

**Updates:** when a new version is deployed, the installed app downloads it in the background. It’s
used from the **next launch**. The app never reloads itself while you’re writing.

## Signing in

The first time the app opens on a device it asks for a username and PIN, then remembers the sign-in on
that device until **Settings → Sign out**. Signing out never touches the notes.

This is a front door, not a vault: there's no server, so the check happens on the device. Only a hash of
the username and PIN is in the source (the repo is public); make a new one with
`node scripts/login-hash.mjs <username> <pin>` and paste it into `PASS` in `src/ui/login.ts`.
On iPad, Safari and the Home Screen app keep separate storage, so sign in again after adding it to the
Home Screen (and use the app from there — that's where the notes live).

## Installing on the iPad

1. Open the GitHub Pages URL in **Safari**. It must be Safari for Add to Home Screen.
2. Tap **Share** (the square with an arrow) → **Add to Home Screen** → **Add**.
3. Open **Quest Board from the Home Screen icon** once while online, so it can cache itself for offline use.
4. To put it in the Dock: on the Home Screen, touch and hold the icon until the icons jiggle, then drag it
   into the Dock and tap **Done**.

It opens straight onto the board, with no splash screen or login, and returns to the board, pan and zoom
you left.

> **Important:** the Home Screen app keeps its own storage, separate from Safari tabs. Always use the
> Home Screen icon. **Removing the app from the Home Screen deletes all of its notes.** Export a backup
> first (Settings → Export backup).

## Data safety

- **Autosave:** every change is written to IndexedDB within ~¼ second. Anything pending is flushed
  immediately when the app goes to the background or closes, including a stroke that’s still in progress.
- **Persistent storage:** the app asks for `navigator.storage.persist()` on first launch. Settings shows
  whether it was granted.
- **Export:** Settings → **Export backup** writes one versioned JSON file containing both boards, all
  notes (ink, text, photos and photo markup), the Vault, XP, Nova's outfit and settings. It shows the size first;
  then tap **Save backup** and choose **Save to Files**.
- **Import:** Settings → **Import backup…** checks the file, shows a summary, and asks before replacing
  anything. Older backups (without text or photos) import fine.
- **Storage:** Settings shows the total space the app uses, with photos listed separately.
- **Weekly nudge:** if no backup has been made in 7 days, a small banner offers a one-tap export.

## Reminders

Open a note → **Remind me** → pick a time and write a short label (Scribble works in the field) →
**Save reminder**. The app pins the due time on the note and hands off to the Shortcuts app, which
creates the reminder in Apple Reminders. Set the Shortcut up once using
**[SHORTCUT_SETUP.md](SHORTCUT_SETUP.md)**.

---

## Project structure

```
design/quest-board/     The design handoff (reference only, not built): SPEC, tokens, mock screens
index.html              App shell (CSP meta injected at build, iPadOS meta tags, manifest link)
vite.config.ts          Relative base, CSP injection, generates sw.js precache list + version hash
sw/sw.js                Hand-written service worker template (cache-first app shell, old-cache cleanup)
public/                 manifest.webmanifest, icons/, licenses/ (copied verbatim)
scripts/make-icons.mjs  Rasterises the icon artwork to PNG with no dependencies
scripts/port-avatar.mjs Ports Nova's SVG template from design/…/Avatar.dc.html into src/avatarSvg.gen.ts
scripts/rig.mjs         Adds the animation joints the design lacks: elbows, a waist, arms that can come in front
avatar-test.html        Dev-only page: all 33 outfits × 20 emotes (src/avatarTest.ts)
src/
  main.ts               Boots the shell synchronously, loads data, wires everything together
  types.ts              Data model, priority table, inks, outfit types
  db.ts                 IndexedDB with versioned migrations (v1 notes, v2 photos, v3 grid redesign)
  migrate.ts            Upgrades free-board notes (rarity, 240-unit ink, dark inks) — shared with import
  store.ts              In-memory state, undo/redo, debounced autosave, change events
  actions.ts            Every note mutation (create / ink / erase / move / complete / …) as one undo step
  page.ts               The note "page" (photo + text + ink) and how every surface draws it
  days.ts               Local calendar-day helpers (next Wednesday, days in Today, week end)
  card.ts, board.ts     Cards and the Today / This Week / Backlog columns
  gestures.ts           Board input: pen vs finger, tap / hold-to-complete / drag targets / two-finger undo
  stroke.ts, ink.ts     Pencil capture (coalesced + predicted events) and perfect-freehand rendering
  avatar.ts             Nova: 33 outfits, palettes, hair/skin/accessories, Look → SVG (renderVals port)
  avatarSvg.gen.ts      GENERATED SVG template (do not edit; re-run scripts/port-avatar.mjs)
  emotes.ts, emotes.css The 20 emotes (choreography on the rig) and how to play one on a figure
  images.ts, photos.ts  On-device photo processing, bitmaps/URLs, picker, drop and paste
  xp.ts                 Levels (300 XP rising to 1000) and streak, derived from completed notes
  rewards.ts            The Reward Track: starter kit, what each level unlocks, unlock checks
  backup.ts             Export (sized, Web Share / download) and validated import of v1–v3 backups
  safari.ts             Suppresses Safari zoom / selection / callout / bounce
  tokens.css            Design tokens + avatar motion, copied from the handoff
  styles.css            Everything else
  ui/                   topbar, hero, noteSheet (Write/Speak/Photo/View), locker, vault, viewer,
                        reminder, settings, overlay (sheets + toasts), rewards (Reward Track + level-up)
```

### Data model (IndexedDB `quest-board`, schema v3)

- **`notes`** (key `id`, indexes `board`, `status`):
  `{ id, board: 'work'|'personal', zone: 'today'|'week'|'someday', due?: 'mon'…'sun',
  dueDate?: 'YYYY-MM-DD' (the real date behind the day chip), todaySince? (when it entered Today), z (order),
  priority: 'low'|'normal'|'high'|'urgent', strokes, text?, imageIds?, markup?, reminder?,
  createdAt, updatedAt, status: 'active'|'done', completedAt?, xp? }`
  - `strokes: [{ color, size, tilt, tool?: 'highlighter', points: [[x, y, pressure], …] }]` on the note's
    **page** (1000 × 800 units). The page also lays out the photo (a taped polaroid) and the text, so ink
    always lines up with what it annotates. Cards zoom to the part of the page with content.
  - `markup` strokes are normalised to the photo's longest edge (0–1), keyed by photo id.
- **`images`** (key `id`): `{ id, type, w, h, full, tw, th, thumb, bytes, createdAt }`, full ≤ 2048 px and
  thumb ≤ 400 px JPEGs as ArrayBuffers. Photos no note refers to are deleted at the next launch.
- **`meta`** (key `key`): `settings` (ink, tool, sound), `view` (last board), `player` (Nova's outfit,
  per-outfit colours `{p,s,a}`, hair style + colour, skin, accessories, ★ victory emote, `best` = highest level
  reached, `unseen` = NEW reward keys, `kept` = rewards kept regardless of level), `backup` (last export), `install` (first launch, persist requested).
- XP, level and streak are **derived** from completed notes (`xp` is stamped at completion).
- **v3 migration** (from the free-form board): rarity → priority (Common/Rare → Normal, Uncommon → Low,
  Epic → High, Legendary → Urgent); ink moved onto the page and dark inks turned light; positions and
  stacks dropped. Older backups go through the same conversion on import.

### Content Security Policy

Shipped exactly as specified, via a `<meta>` tag (GitHub Pages can’t set headers):

```
default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self';
style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'
```

The only change is dev-only (`ws:`/`wss:` for Vite hot reload). The design's Google Fonts are bundled
instead (Barlow, Barlow Condensed via `@fontsource`), so no font or style comes from another origin.
Photos are drawn from decoded bitmaps or shown through `blob:` URLs (already allowed by `img-src`). Vite’s asset inlining is disabled so the
font is always a same-origin file, never a `data:` URI.

### Ready for later (not built yet)

The architecture leaves room for these:

- **Brain-dump mode:** strokes end in `NoteSheet.commitStroke`; a pause timer there can open the next note.
- **Morning top three / Sunday review:** notes from both boards are already in memory (`store.notes`).
  These would be new sheets, like the Vault.
- **Due glow and badge count:** `reminder.due` is stored as ISO. Add a class in `Card.buildChrome` and
  call `navigator.setAppBadge` from the store listener.
- **Aging notes:** `createdAt`/`updatedAt` are on every note; aging is a CSS variable set in `Card.update`.
- **Scribbled labels and search:** add an optional field to `Note` plus a migration.
- **PIN-locked Private zone:** zones are table-driven (`ZoneId`, `BoardView.column`). Encrypted notes would
  hold an AES-GCM ciphertext of their content (key from PBKDF2) behind a new schema version.

## Licences

- Barlow and Barlow Condensed fonts © The Barlow Project Authors, SIL Open Font License 1.1
  (`public/licenses/`), bundled via `@fontsource`.
- `perfect-freehand` © Steve Ruiz, MIT.
- Visual design from the project's own design handoff (`design/quest-board/`). Nova, her outfits, the
  icons and sounds are original (icons generated by `scripts/make-icons.mjs`, sounds synthesised at
  runtime).
