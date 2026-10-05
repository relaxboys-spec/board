# Quest Board — design handoff

Designs for the iPad sticky-note board PWA, made in a Claude design canvas. This folder is a reference only: nothing here is imported by the build.

```
design/quest-board/
  README.md     ← you are here: how to use this folder
  SPEC.md       ← the design: look, screens, interactions, data model
  AVATAR.md     ← Nova: layered avatar, 33 outfits (incl. 4 sarees), hair, accessories, Locker, 20 emotes
  tokens.css    ← colours, fonts, shapes, idle + celebration animations (plain CSS, ready to paste)
  emotes.css    ← the 20 emote animations (wrapper class em-<id>)
  screens/      ← source of each mocked-up screen (see "Reading the screens")
    Main.dc.html     board: Today / This Week / hero
    Write.dc.html    new-note sheet: Write · Speak · Photo
    View.dc.html     open note with photo
    Locker.dc.html   outfits, colours, hair, accessories, skin, emotes
    Avatar.dc.html   Nova, the hero: the layered SVG and the full outfit table
```

## For Claude Code: how to build from this

Target stack: **TypeScript (strict) + Vite, no UI framework, one plain CSS stylesheet, PWA with a service worker, no backend.**

1. Read `SPEC.md` first, then `AVATAR.md` for everything about Nova. It is the source of truth for behaviour; the screens show the exact layout and styling.
2. Copy `tokens.css` into the app stylesheet (or `@import` it). Use its custom properties and classes rather than retyping hex values.
3. Build each screen as plain DOM, rendered from TypeScript (template strings or `document.createElement`), with state in a small store module. Suggested modules:
   - `board.ts`
   - `noteSheet.ts` (handles both Write and View)
   - `locker.ts`
   - `avatar.ts`: returns the SVG for a `Look` (see `AVATAR.md`), ported from `Avatar.dc.html`: its `OUTFITS` table and `renderVals()` flags map one-to-one to which layers to draw
   - `emotes.ts`: the emote list and durations (from `Locker.dc.html` → `EMOTES`) and a `playEmote(id)` that swaps the wrapper class
   - `store.ts`: IndexedDB
4. Copy `emotes.css` into the stylesheet too. Keep the avatar's SVG class names (`av-body`, `av-arm-l`, `av-arm-r`, `av-head`, `av-shadow`); the animations in `tokens.css` target them.
5. Respect `prefers-reduced-motion`. `tokens.css` already disables the animations for it.

### Reading the screens (`*.dc.html`)

They are written in a small templating format, not plain HTML. To translate:

| In the file | Means | In vanilla TS |
|---|---|---|
| `{{name}}` | value from `renderVals()` in the `<script type="text/x-dc">` block at the bottom | interpolate from state |
| `<sc-for list="{{items}}" as="item">` | repeat for each item | `items.map(...)` |
| `<sc-if value="{{flag}}">` | render only when true | conditional render |
| `onClick="{{fn}}"` | click handler | `addEventListener('click', …)` |
| `<dc-import name="Avatar" outfit="…">` | embed `Avatar.dc.html` with those props | call `avatar.ts` |
| `<helmet>` | page-level `<style>` and font links | goes in the stylesheet / `index.html` |
| `class Component extends DCLogic` | the screen's state and logic | port into the screen's TS module |
| `<script src="./support.js">` | the design tool's runtime | ignore |

All sizes are in CSS px for a 1194 × 834 iPad viewport. The sample notes and numbers (level 12, 7-day streak, "Resets in 9h 12m") are placeholders.

### Things to sort out for this project

- **Fonts and the Content Security Policy.** The mockups load Barlow, Barlow Condensed and Caveat from Google Fonts. For an offline-first PWA, self-host them instead: put the `.woff2` files in `public/fonts/`, declare them with `@font-face`, and add them to the service-worker cache list. If you keep Google Fonts, the CSP plugin needs `style-src https://fonts.googleapis.com` and `font-src https://fonts.gstatic.com`.
- **Photos.** Showing photos stored in IndexedDB needs `img-src blob:` in the CSP.
- **Dictation.** `webkitSpeechRecognition` in iPad Safari sends audio to Apple's service and needs a network connection. Hide or disable **Speak** while offline.
- **Caveat is a placeholder.** Real notes are the user's Pencil strokes. Keep Caveat only for empty states or sample content.

## Live designs

The interactive versions (press Play on each screen) are on the Claude canvas "Quest Board". It is private to its owner until shared from its Share menu.
