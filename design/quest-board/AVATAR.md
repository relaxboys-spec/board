# Nova — hero avatar, wardrobe and emotes

Source of truth: `screens/Avatar.dc.html` (drawing and outfit table), `screens/Locker.dc.html` (Locker UI, colour palettes, unlock levels), `emotes.css` (all emote animations).

Nova is one inline SVG, `viewBox="0 0 200 300"`, built in layers. Build her as a TypeScript function that returns SVG markup for a **look**:

```ts
interface Look {
  outfit: OutfitId;
  primary?: string; secondary?: string; accent?: string;   // empty = the outfit's defaults
  hairStyle: HairStyle;
  hair: string;            // hex
  skin: string;            // hex
  accessories: AccessoryId[];
  lite?: boolean;          // thumbnails: no blur, no rim light
}
```

---

## 1. How she is built

### 1.1 Rig: these class names drive every animation

| Class | Element | Pivot (`transform-box: fill-box`) |
|---|---|---|
| `av-shadow` | ground ellipse | centre |
| `av-body` | everything except the shadow | bottom centre (`50% 100%`) |
| `av-arm av-arm-l` | viewer's-left arm: skin, sleeve, hand, watch/bangles | shoulder (`50% 6%`). A positive rotation raises it outward. |
| `av-arm av-arm-r` | viewer's-right arm | shoulder. A negative rotation raises it outward. |
| `av-head` | head, face, hair front, headwear | neck (`50% 90%`) |

**Rule:** never put a large shape (such as a full-canvas rect) inside an animated group. The pivot is computed from the group's bounding box, so a large shape moves the pivot (that bug once swung her head off her neck).

### 1.2 Pose
- **Weight on the viewer's-left leg.** The other knee is bent and that foot turned out.
- **Tilts:** the hips tilt one way. The upper body sits in `rotate(-3 100 138)`, which tilts the shoulders the other way, and the head wrapper adds `rotate(5 100 52)`.
- **Animated groups go inside the static wrappers.** CSS `transform` on an element overrides its SVG `transform` attribute, so a group that animates can't also carry the pose rotation itself.

### 1.3 Paint order
1. **Lower body:**
   1. ground contact shadows
   2. skin legs and feet
   3. *shoes, if under* (wide trousers and saree skirts)
   4. bottoms
   5. belt or waistband
   6. *shoes, if over*
2. **Upper body:**
   1. back hair (braid / ponytail / long / curly mass)
   2. saree pallu, the part hanging down the back
   3. backpack body
   4. arms (skin, then sleeves, hand, wrist accessories)
   5. neck and bare torso
   6. top
   7. necklace
   8. outer layer
   9. headphones, crossbody bag, backpack straps
   10. saree pallu across the front
   11. head
   12. long hair locks in front of the shoulders

The head is drawn in this order:
1. back hair
2. ears and face, with soft shading
3. brows, eyes, nose, lips, bindi
4. front hair or fringe
5. earrings
6. glasses
7. cap or beanie

### 1.4 Lighting
- **Gradients** per paint (skin, hair, top, outer, bottom, sleeve, shoe, gold) run light at the left to dark at the right. Give every gradient, pattern and filter id a **per-instance prefix**, because many Novas share a page.
- **Rim light:** one SVG filter on the body group traces the right-hand silhouette in cyan `#8EEBFF`:
  1. take `SourceAlpha`
  2. shift a copy of it 2.4 px left
  3. remove the shifted copy from the original (composite `out`), leaving a thin right-hand edge
  4. blur that edge 0.6
  5. fill it cyan
  6. merge it over the drawing
- **Soft contact shadows** (`feGaussianBlur` 1.8) sit under the chin, the collar, the jacket edges, the hem, the belt and the bag, and between the legs. Soft highlights sit on the forehead, cheekbones, nose bridge, lips and hair. All of these are hidden when `lite`.
- **Fabric:** a 3 px twill pattern on denim, ribbing lines on cuffs, hems and collars, dashed stitching on seams, and fold lines at the elbows, knees and waist.

### 1.5 Colour helpers
Each garment colour `c` is drawn with `lighten(c, .22–.25)` → `c` → `darken(c, .28–.35)`. Sneaker soles flip between grey and white depending on the shoe's brightness.

---

## 2. Wardrobe: 33 outfits

An outfit is a recipe of parts plus where each part takes its colour from: `p` / `s` / `a` (the player's three colour slots) or a fixed hex. The full table is `OUTFITS` in `Avatar.dc.html`.

**Parts library**

| Group | Parts |
|---|---|
| Tops | tee (short sleeves), tank (sleeveless), shirt (collar, short), blouse (collar, long), long-sleeve, turtleneck, sweater (ribbed, knit), hoodie (hood, pocket, drawstrings), saree blouse (short), sleeveless saree blouse |
| Outer layers | bomber (+ varsity sleeves, + track stripes), denim jacket, blazer, leather biker, trench (long, belted), puffer (closed, quilted, puffy sleeves), utility vest (sleeveless), cardigan |
| Bottoms | joggers, cargo, jeans, leggings, wide-leg, shorts (denim or tailored), pleated mini, midi skirt, pencil skirt, A-line skirt, saree skirt, nauvari |
| Shoes | sneakers, high-tops, ankle boots, heels, loafers, sandals, embroidered flats (juttis) |

**Sleeves:** an outer layer (except the vest) gives long sleeves in the outer colour, or in `a` for the varsity outfit. Without one, the top decides. A dress is a top plus a skirt in the same colour.

| Category | Outfits (unlock level when above 1) |
|---|---|
| Street | Street Runner, Denim Daze, Cargo Ops, Skater, Utility Hoodie, Rock Edit (13), Biker Night (14), Varsity (20) |
| Casual | Cozy Hoodie, Summer Sun, Knit Weekend, Sundress, Cardigan Café, Shirt Dress, Festival (15), Puffer Peak (16) |
| Work | Boardroom, Trench Classic, Mechanic, Shirt & Slacks, Office Knit, Power Shorts (25) |
| Active | Tennis Club, Athleisure, Track Star |
| Evening | Little Black Dress, Monochrome, Jumpsuit (18), Evening Bodycon (22) |
| Traditional | Nivi Silk Saree, Kanjivaram Silk, Party Saree, Nauvari Saree |

### 2.1 Sarees

| Drape | Defaults (p / s / a) | Details |
|---|---|---|
| **Nivi Silk** | crimson / gold blouse / gold | front pleat fan, contrast hem border, pallu diagonally across the chest, over the shoulder and down the back with tassels |
| **Kanjivaram Silk** | magenta / gold / gold | gold diamond motifs all over; a wide gold hem border with a contrast stripe and a row of temple triangles; the pallu has 6 px gold edges and a solid gold end with contrast stripes |
| **Party Saree** | purple / black sleeveless blouse / lilac | **sheer**: the skirt at 62 % opacity over a darker underskirt, the pallu at 48 %; sequins all over (blouse too); a thin border with a dotted shimmer; heels |
| **Nauvari** (nine-yard) | green / purple / gold | worn dhoti-style: each leg wrapped to mid-calf with a zari hem, a central pleated panel, a gold waistband, the pallu across the chest; ankles and shoes show |

All four use embroidered flats in `a`, except the Party Saree, which uses heels. The Locker suggests a look for them: jhumkas, bangles, bindi and a bun.

---

## 3. Hair, accessories, skin

- **Hairstyles (8):** braid, ponytail, bun, bob, long, curly, pixie, space buns. Each has a back layer (behind the body), a skull layer and a front layer. A cap or beanie hides the buns and the hair tie.
- **Hair colours:** `#1A1420 #2A1A14 #5A3220 #8A4B26 #C98A3E #E8D3A0 #FF6FAE #7B5CFF`
- **Skin tones:** `#F8DCC8 #F1C6A7 #E2A985 #C98B66 #A86D4A #8A5638 #6A3F28 #4A2C1C`
- **Accessories (13):**
  - **Face and ears:** glasses, sunglasses, hoops, jhumkas, bindi.
  - **Head:** cap, beanie.
  - **Body:** necklace, headphones, crossbody bag, backpack, watch, bangles.

  Mutually exclusive pairs: glasses/sunglasses, hoops/jhumkas, cap/beanie. With no earrings chosen she wears small studs in the accent colour. The cap and beanie use the outfit's accent colour.
- **Outfit colour palette (12):** `#F2F6FF #1B1F2A #4A6FA5 #C9B79C #B3122E #FF6FAE #FF8A3C #FFC83D #2BA36B #1F7F86 #2F5BD8 #6B3FD0`

---

## 4. Locker screen

- **Header:** back button, "LOCKER", level, and the main button, which reads **Equip** / **Equipped** / **Unlocks at Lv N** (disabled when locked).
- **Preview (320 px):** Nova at 1.4×. Above her: the rarity and category tag, the outfit name, and the status (Equipped / Previewing / Locked). Below: a **Play [victory emote]** button.
- **Outfits (430 px):**
  - **Filters:** All · Casual · Street · Work · Active · Evening · Traditional.
  - **Grid:** three columns, scrolling. Each 206 px card is a rarity gradient with a lite Nova at 0.55× in that outfit's colours plus the current hair, skin and accessories, and a footer with the name and rarity.
  - **States:** the "EQUIPPED" tag, a yellow frame on the selected card, and a padlock with "Lv N" on locked ones.
- **Styles (remaining width):** tabs **Colors · Hair · Extras · Skin · Emotes**.
  - **Colors:** three slots named for the outfit (for example "Sheer saree / Sleeveless blouse / Border, sequins & heels"), 12 swatches each, and Reset.
  - **Hair:** 8 style buttons and 8 round colour swatches.
  - **Extras:** 13 toggle tiles with checkboxes. The saree outfits also show an "Apply" button for the suggested look.
  - **Skin:** 8 round tones.
  - **Emotes:** 20 rows, each with a play button and a ★ button that sets the victory emote. Thumkas carries a **NEW** tag.
- **Saved per player:** each outfit keeps its own colour overrides. Hair, skin, accessories and the victory emote are global.

---

## 5. Emotes (`emotes.css`)

**To play one:**
1. Set the avatar wrapper's class to `em-<id>`, for example `<div class="em-thumkas">…<svg>…</svg></div>`.
2. After the duration plus 200 ms, set it back to `av-idle`.
3. To replay the same emote, clear the class first and set it again about 30 ms later; otherwise the animation won't restart.

| id | Name | ms | Movement |
|---|---|---|---|
| `victory` | Victory | 1500 | crouch, big jump, double fist pump, squash on landing |
| `thumkas` | **Thumkas** | 3000 | five hip pops side to side; right hand up with wrist twirls, left hand on hip, head tilting against each pop |
| `wave` | Wave | 2000 | right arm up waving, head tilt |
| `dab` | Dab | 1600 | one arm up and out, the other across the face, head tucked |
| `floss` | Floss | 2400 | both arms swing together while the hips go the other way |
| `clap` | Clap | 2000 | five claps with a bob |
| `spin` | Spin | 1400 | full turn (scaleX flip) with arms out and a hop |
| `jacks` | Jumping Jacks | 2400 | four jacks |
| `salute` | Salute | 2000 | hand to brow, standing tall |
| `namaste` | Namaste | 2200 | palms together, small bow |
| `bhangra` | Bhangra | 2400 | both arms up pumping, bouncing |
| `shrug` | Shrug | 1600 | shoulders and arms up, head tilt |
| `laugh` | Laugh | 2000 | head back, hands to belly, shaking |
| `flex` | Flex | 2000 | double biceps flex with pulses |
| `heart` | Heart Hands | 2200 | hands overhead, swaying |
| `headbang` | Headbang | 2000 | fast head nods, rock fist up |
| `disco` | Disco | 2400 | point up, then down across the body, hips swaying |
| `robot` | Robot | 2400 | stepped (`steps(1,end)`) arm and head poses |
| `garba` | Garba | 2800 | alternating overhead claps, swaying |
| `bow` | Bow | 2000 | bow forward, hands together in front |

**Completing a quest:** the board plays the player's ★ victory emote, adds the confetti, ring and XP pop from `tokens.css` (`av-conf`, `av-ring`, `av-pop`), and changes the status line to "QUEST COMPLETE!".

**Reduced motion:** `prefers-reduced-motion` turns all emote animation off.

**Known limit:** the legs and hips are part of `av-body`, so the dance moves sway the whole body. For real hip and knee work, split the lower body into its own groups (`av-hips`, `av-leg-l`, `av-leg-r`) with pivots at the hips and knees, and extend the Thumkas, Bhangra and Garba keyframes.
