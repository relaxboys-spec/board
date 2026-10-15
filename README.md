# Board

A handwritten task board for iPad and Apple Pencil, installed to the Home Screen as a web app.
Tap the Pencil anywhere and a task appears. Write on it, and it’s saved. No typing, titles, folders or
save button.

Everything stays on the iPad, in IndexedDB. There’s no server, no analytics and no network requests
for data. The whole app works offline once it’s installed.

The look is calm and Linear/Notion-like: a bar across the top (Work and Personal boards, Backlog, Done,
her level card for Profile, Settings) and two columns, **Today** and **This week**. Three appearances in **Settings → Appearance**:
**Light**, **Dark**, and **Glass** (frosted panes over a wallpaper: four built-in gradients or her own
photo), plus eight **accent colours**. The game parts (avatar, levels, Locker, rewards) live quietly in
**Profile**.

## How it works (cheat sheet)

| You do… | With | What happens |
|---|---|---|
| Tap **+ New task**, or empty space in a column | Pencil / finger | New task in that column, opened big for writing |
| Tap the mic or camera on a **New task** row | Finger | New task straight into **Speak** (keyboard up) or **Photo** (picker open) |
| Touch a task | Pencil | Opens it for writing |
| Tap a task | Finger | Opens it: details, actions, **Start** / **Pause**, **Complete** |
| Tap the circle on a task | Finger / Pencil | To do → **In progress** → **Done** (tap a done one to un-complete) |
| Hold a task still | Finger | It lifts and a bar fills: a to-do task **starts** (amber bar); hold an in-progress one again to **complete** it |
| Hold a task, then move (or swipe it sideways) | Finger | Drag it: to the other column, or onto Work / Personal, Backlog or Done in the top bar |
| Swipe up and down in a column | Finger | Scroll |
| Tap with two fingers | Fingers | Undo (also the ↶ button) |

**In a task:** **Write**, **Speak** and **Photo** tabs; the side panel sets **priority**, **status**
(To do / In progress), **due** (Today / This week + day / Someday, with an optional day or week) and **board**. Changes save as you make
them; **Add task** / **Done** just closes it. An untouched empty task disappears on its own.

**Status:** an empty circle is To do, a half-filled amber circle is **In progress**, a filled circle is
Done. Starting, pausing and completing are all undoable.

**Order:** each column sorts itself: **In progress** tasks first, then **Urgent → High → Normal → Low**,
then the ones completed today. Dragging reorders tasks within the same group; changing a priority moves
the task to its new group straight away.

**Someday with a date:** choosing Someday shows **No date / A day / A week** and a small calendar. A day
puts the task back in **This week** (with its weekday) on the Monday of that week, then in **Today** on the
day; a week puts it back in **This week** on that Monday. The Backlog card shows the plan (**Wed 28 Oct** or
**Week of 2 Nov**). Moving the task out of the Backlog drops the plan.

**Writing tools** (tap them with a finger or the Pencil): pen, highlighter, eraser, lasso (circle strokes, then drag them, or tap the red
bin), four inks, undo / redo. Pen strokes are always kept as ink: use the eraser, lasso or undo to remove
them. Her inks are drawn in a readable shade for each appearance (white ink shows as near-black in Light).

**Priority** is a coloured label on each card — red **Urgent** (flame), orange **High** (double up-arrow),
blue **Normal** (dot), grey **Low** (down-arrow) — and sets the XP a task earns: 25, 50, 100, 150. Level 1 needs 300 XP, each level after that 100 more, up to 1000 XP per level from
Level 8 on. The streak counts days with at least one finished task. Completing shows a quiet
"Completed · +XP" message with Undo.

**Each day** (checked when the app opens, at midnight, when she comes back to it, and when a task is
closed):

- **Completed tasks** stay on the board, dimmed with a filled circle, until midnight, then move to **Done**
  (top bar), grouped by day, where you can **Put back** any of them.
- **Unfinished Today tasks stay put.** From their second day they show a small **Day 2**, **Day 3**…
  chip, orange from day 3, so she can see what's carrying over. Nothing moves or disappears on its own.
- **This week tasks with a day move into Today on that day**, at the top of their priority group. A day picked always means
  the next time it comes round (a Wed picked on a Thursday is next week's, and its chip says
  **Next Wed**). If the app wasn't opened that day, they arrive next time, aged from their day.
- **This week tasks without a day** stay in This week until she moves them.
- **Planned Backlog tasks** come back as described above; the board says "N planned tasks are back".

**Profile** (her level card at the right of the top bar, or her name at the left): her avatar, level, XP,
streak and counts, and the way into the **Locker**, **Emotes** and **Rewards**.

**Completing a task** pops her avatar up (large) in the corner for about 3.5 seconds, playing her ★ victory emote,
with the XP earned. **Settings → Celebrate with my avatar** turns it off.

**Locker:** 33 outfits in six categories (Casual, Street, Work, Active, Evening, Traditional — including four
sarees). Tap a card to preview, **Equip** to wear it. Under it: **Colors** (three slots per outfit,
remembered per outfit), **Hair** (8 styles, 8 colours), **Extras** (13 accessories — a saree offers to
apply jhumkas, bangles, bindi and a bun), **Skin** and **Emotes** (20). At the top of Emotes she picks her
**victory emote**: all 20 are listed, locked ones with their level (tap one to preview it); **Change**
under the preview jumps there.

**Rewards (levelling up unlocks things):** she starts with 5 outfits, 2 hairstyles, 3 hair colours,
4 outfit colours, 2 extras, 3 emotes and every skin tone (skin is never locked). Every level up to 30 unlocks
something, and every fifth level is a named milestone (5 Festive Pack: Nivi saree, jhumkas, bindi, Thumkas ·
10 Party Night · 15 Nine Yards · 20 Temple Silk · 25 Varsity Legend · 30 Boss Mode). The full list is in
`src/rewards.ts`.
- Completing the task that reaches a new level opens a **Level up!** card with the new outfit, the other
  rewards, **Wear** it now, or open the Locker.
- New things carry a **NEW** badge (and a count on her level card) until she has looked at them.
- Locked things show the level they unlock at. Tapping one **tries it on** in the Locker preview without
  saving; locked emotes can be previewed too.
- Unlocks are never taken back — un-completing a task lowers the XP but not what she has unlocked.

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

**Avatar test page:** with `npm run dev` running, open http://localhost:5173/avatar-test.html to see the avatar
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

1. Create a GitHub repository (e.g. `board`) and push this folder to its `main` branch.
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
3. Open **Board from the Home Screen icon** once while online, so it can cache itself for offline use.
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
  tasks (ink, text, photos and photo markup), Done, XP, her avatar and settings (not the uploaded wallpaper). It shows the size first;
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
design/quest-board/     The original game-style design handoff (reference for the avatar only)
index.html              App shell (CSP meta injected at build, iPadOS meta tags, manifest link)
vite.config.ts          Relative base, CSP injection, generates sw.js precache list + version hash
sw/sw.js                Hand-written service worker template (cache-first app shell, old-cache cleanup)
public/                 manifest.webmanifest, icons/, licenses/ (copied verbatim)
scripts/make-icons.mjs  Rasterises the icon artwork to PNG with no dependencies
scripts/port-avatar.mjs Ports the avatar's SVG template from design/…/Avatar.dc.html into src/avatarSvg.gen.ts
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
  avatar.ts             The avatar: 33 outfits, palettes, hair/skin/accessories, Look → SVG (renderVals port)
  theme.ts              Appearance (light / dark / glass), accent, wallpaper; theme-aware ink and page colours
  avatarSvg.gen.ts      GENERATED SVG template (do not edit; re-run scripts/port-avatar.mjs)
  emotes.ts, emotes.css The 20 emotes (choreography on the rig) and how to play one on a figure
  images.ts, photos.ts  On-device photo processing, bitmaps/URLs, picker, drop and paste
  xp.ts                 Levels (300 XP rising to 1000) and streak, derived from completed tasks
  rewards.ts            The Reward Track: starter kit, what each level unlocks, unlock checks
  backup.ts             Export (sized, Web Share / download) and validated import of v1–v3 backups
  safari.ts             Suppresses Safari zoom / selection / callout / bounce
  avatar.css            Avatar idle motion and dictation animations
  styles.css            Theme tokens (three appearances) and every screen
  ui/                   sidebar (the top bar), profile, icons, noteSheet (Write/Speak/Photo/View), locker, vault (Done), viewer,
                        reminder, settings, overlay (sheets + toasts), rewards (Reward Track + level-up)
```

### Data model (IndexedDB `quest-board` — the name predates the rename and must stay — schema v3)

- **`notes`** (key `id`, indexes `board`, `status`):
  `{ id, board: 'work'|'personal', zone: 'today'|'week'|'someday', due?: 'mon'…'sun',
  dueDate?: 'YYYY-MM-DD' (the real date behind the day chip, or a Backlog task's planned day),
  dueWeek?: 'YYYY-MM-DD' (a Backlog task's planned week, as its Monday), todaySince? (when it entered Today), z (order),
  priority: 'low'|'normal'|'high'|'urgent', strokes, text?, imageIds?, markup?, reminder?,
  createdAt, updatedAt, status: 'active'|'done', completedAt?, xp? }`
  - `strokes: [{ color, size, tilt, tool?: 'highlighter', points: [[x, y, pressure], …] }]` on the note's
    **page** (1000 × 800 units). The page also lays out the photo (a taped polaroid) and the text, so ink
    always lines up with what it annotates. Cards zoom to the part of the page with content.
  - `markup` strokes are normalised to the photo's longest edge (0–1), keyed by photo id.
- **`images`** (key `id`): `{ id, type, w, h, full, tw, th, thumb, bytes, createdAt }`, full ≤ 2048 px and
  thumb ≤ 400 px JPEGs as ArrayBuffers. Photos no note refers to are deleted at the next launch.
- **`meta`** (key `key`): `settings` (ink, tool, sound, appearance, accent, wallpaper, celebrate), `view` (last board), `player` (her avatar's outfit,
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

The only change is dev-only (`ws:`/`wss:` for Vite hot reload). The app uses the iPad's own system font,
so no font is downloaded at all. Photos and the uploaded wallpaper are drawn from decoded bitmaps or shown
through `blob:` URLs (already allowed by `img-src`); built-in wallpapers are CSS gradients.

### Ready for later (not built yet)

The architecture leaves room for these:

- **Brain-dump mode:** strokes end in `NoteSheet.commitStroke`; a pause timer there can open the next note.
- **Morning top three / Sunday review:** notes from both boards are already in memory (`store.notes`).
  These would be new sheets, like Done.
- **Due glow and badge count:** `reminder.due` is stored as ISO. Add a class in `Card.buildChrome` and
  call `navigator.setAppBadge` from the store listener.
- **Aging notes:** `createdAt`/`updatedAt` are on every note; aging is a CSS variable set in `Card.update`.
- **Scribbled labels and search:** add an optional field to `Note` plus a migration.
- **PIN-locked Private zone:** zones are table-driven (`ZoneId`, `BoardView.column`). Encrypted notes would
  hold an AES-GCM ciphertext of their content (key from PBKDF2) behind a new schema version.

## Licences

- `perfect-freehand` © Steve Ruiz, MIT.
- The avatar comes from the project's own design handoff (`design/quest-board/`). The avatar, her outfits,
  the wallpapers, icons and sounds are original (icons generated by `scripts/make-icons.mjs`, sounds synthesised at
  runtime).
