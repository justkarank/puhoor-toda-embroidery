# SPEC.md — Toda Embroidery: The Side We Misread

> **Note:** this spec refers to a `reference/` folder of documentary photographs of real Toda cloth that were used as visual references for image generation. Those photographs belong to their original sources (credited in the README) and are not included in this repository.


This document is the single source of truth. Build exactly to it. Where this
document and any other instruction disagree, this document wins.

---

## 0. What this is

A desktop-first, scroll-driven digital exhibition about Toda embroidery
(*pukhoor*), the counted-thread work of the Toda community of the Nilgiris.

**Thesis:** the embroidery is not only the visible pattern. It is the hidden
construction, the counting, the labour, the place and the human authorship
behind it.

**The site enacts the thesis rather than stating it.** Each chapter opens on a
misreading and corrects it. The visitor is corrected seven times.

**The spine is counting, not scrolling.** The site never shows a percentage.
It shows stitches. The preloader counts to the total. The right-edge thread
counts as the visitor descends. Motifs draw at speeds derived from their real
unit counts. The interactive chapter puts the visitor's own count against the
total.

---

## 1. Stack

- Vite + TypeScript. **No framework.** No React, no Vue.
- GSAP 3 + ScrollTrigger for all scroll-driven timelines.
- Lenis for smooth scroll.
- Plain SVG for the thread navigation and motif drawing.
- Canvas 2D for frame sequences and the counted-grid interactive.
- Deploy target: Netlify. Static build, no server.

Do not add any other runtime dependency without a stated reason.

---

## 2. Design tokens

These are derived from photographs of the real object. Do not substitute.

```css
:root {
  /* Ground colours — the object has THREE grounds, not one */
  --cloth:      #E4DAC6;  /* coarse undyed handloom cotton, warm off-white */
  --cloth-lit:  #F0E8D8;  /* same cloth under direct light */
  --ink:        #0B0B0C;  /* page darkness — NOT the thread black */
  --black:      #151313;  /* thread black, sampled from the object */
  --red:        #C4122F;  /* bright, cool scarlet; never maroon or brick */
  --red-cloth:  #D31027;  /* the solid red border cloth */
  --slate:      #5A6570;  /* Nilgiris only — the site's one departure */

  /* Type */
  --font-display: 'Fraunces', serif;
  --font-label:   'Space Grotesk', sans-serif;
  --font-mono:    'IBM Plex Mono', monospace;

  /* Lattice */
  --cell: 22px;

  /* Easing */
  --ease-in:  cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out: cubic-bezier(0.7, 0, 0.84, 0);
}
```

**Critical:** `--red` is a bright cool scarlet. It is not brick, not rust, not
terracotta. If any asset or UI element renders red as a muted earth tone, it is
wrong.

Fraunces is variable — set `font-variation-settings: 'WONK' 1, 'SOFT' 40;` on
display type. This gives the archival, letterpress quality the subject needs.

`--font-mono` must use `font-variant-numeric: tabular-nums` everywhere a number
changes, so the counter does not jitter as it ticks.

---

## 3. Type scale

| Role | Face | Size | Notes |
|---|---|---|---|
| Hero title | Fraunces | 76px | line-height 0.95 |
| Chapter thesis line | Fraunces | 34px | line-height 1.3 |
| Section heading | Fraunces | 44px | |
| Pull line | Fraunces | 28px | |
| Body | Space Grotesk | 19px | line-height 1.75, max 62ch |
| Plate caption | Fraunces | 15px | |
| Label / eyebrow | Space Grotesk | 12px | uppercase, 0.14em tracking |
| Annotation | IBM Plex Mono | 12px | |
| Counter | IBM Plex Mono | 13px | tabular-nums |

Load only the weights used: Fraunces 300/400, Space Grotesk 400/500, IBM Plex
Mono 400.

---

## 4. Three global systems

These apply across every chapter and must be built before any chapter exists.

### 4.1 The lattice

A 22px square lattice, fixed behind all content at 3% opacity, drawn as a CSS
repeating gradient. **All layout snaps to it** — margins, baselines, plate
edges, knot positions. Use `--cell` as the base spacing unit throughout.

This is not decoration. It means the counted-grid interactive in Chapter 5 is
the site's hidden structure becoming visible and touchable.

On light-ground chapters, drop lattice opacity to 2%.

### 4.2 Film grain

A tiled noise PNG, `position: fixed`, full viewport, `mix-blend-mode: overlay`,
`pointer-events: none`, `z-index` above everything except the thread nav.

- Opacity **4%** on dark chapters, **2%** on light chapters (cloth / red).
- Animate `background-position` on a 3-step keyframe at 8fps so it flickers
  like film stock.
- Disable entirely under `prefers-reduced-motion`.

This is what makes generated imagery read as one film rather than a folder of
downloads. It is not optional.

### 4.3 The colour grade

Every asset passes through one grade before entering `public/assets/`. Codex
writes `scripts/grade.sh`; the user runs it once over `raw/`.

```bash
ffmpeg -i "$IN" -vf "crop=iw:iw*9/21,eq=saturation=1.0:contrast=1.03,curves=all='0/0.03 0.5/0.5 1/0.97'" "$OUT"
```

ChatGPT wide stills originate at 3:2 and Kling clips at 16:9; both are
cropped to 21:9 during grading. Non-wide assets — motifs, construction,
artisans and textures — receive the same colour grade without the crop.

**Saturation stays at 1.0.** The scarlet is the object's identity — do not
desaturate it. The grade exists to unify black levels across assets, nothing
more.

---

## 5. The chapter contract

This is the most important section of this document. Build this before
building any chapter.

```ts
// src/lib/types.ts

export interface ChapterContext {
  lenis: Lenis;
  stitchTotal: number;
  reducedMotion: boolean;
  loadSequence(name: string, frameCount: number): Promise<HTMLImageElement[]>;
}

export interface Chapter {
  id: string;            // 'construction'
  label: string;         // 'Construction' — knot label in the navbar
  scrollVh: number;      // its scroll length in viewport heights
  pinned: boolean;       // does it pin, or flow
  bg: string;            // ground colour; bleeds into neighbours automatically
  stitches: number;      // its share of the total
  preload?: string[];    // sequence names to begin loading two chapters early
  mount(el: HTMLElement, ctx: ChapterContext): void | Promise<void>;
  timeline(tl: gsap.core.Timeline, el: HTMLElement, ctx: ChapterContext): void;
}
```

And one registry:

```ts
// src/chapters/index.ts
export const chapters: Chapter[] = [
  hero, about, construction, motifs, grid, nilgiris, artisans, closing,
];
```

**That array is the site.** The engine derives from it, and only from it:

- total document height (`sum of scrollVh`)
- each chapter's pin point and scroll range
- the thread path length and where it is segmented
- how many knots the navbar has, their spacing, and their labels
- each chapter's stitch range, and therefore the counter's value at any scroll
- background colour bleeds between neighbours
- the preloader's total

**Adding a ninth chapter must be exactly two actions:** write one file, add one
import to the registry. Nothing recalculates by hand. Reordering is moving a
line. Deleting is removing a line. Build it so this is true, and verify it by
temporarily adding a dummy chapter and confirming the navbar, counter and
scroll all adapt with no other edit.

---

## 6. The engine

`src/main.ts` boots in this order:

1. Init Lenis: `duration: 1.2`, `easing: t => Math.min(1, 1.001 - 2 ** (-10 * t))`.
2. Read the registry. Compute cumulative scroll offsets and stitch ranges.
3. Build section elements sized to `scrollVh`.
4. Call each chapter's `mount()`.
5. Create a ScrollTrigger per chapter; pinned chapters use `pin: true`,
   `scrub: 1`. Flowing chapters use `scrub: 0.6`.
6. Mount the thread navigation, derived from the registry.
7. Run the preloader gate. Release scroll when hero assets are decoded.

**Background bleed:** a single global tween drives `document.body`'s background
colour across chapter boundaries over the final 60vh of each chapter. The Grid
to Nilgiris transition extends this bleed to 100vh. Never a hard cut between
grounds.

---

## 7. The chapters

Total scroll: **1,410vh**.

Progress values below are 0→1 within each chapter's own ScrollTrigger.

---

### 1 · Hero — 220vh, pinned, bg `--ink`

Full-bleed canvas, 96-frame sequence, scrubbed.

The camera begins **inside the weave** — extreme macro, individual warp and
weft threads crossing like structural beams, deep shadow between them. It
reads as architecture because at that scale it is architecture. Scroll pulls
the camera back continuously: beams become threads, threads become weave,
weave becomes a surface, surface becomes a folded cloth in darkness.

The sequence is assembled from two Kling clips: `hero-a` → `hero-b` and
`hero-b` → `hero-c`. Sample 48 frames from each and concatenate them directly
as one 96-frame array. There is no cross-fade: `hero-b` is the shared endpoint,
so the join is frame-exact.

| Progress | Event |
|---|---|
| 0.00 | Frame 0. Title visible, bottom-left, columns 1–5, baseline 120px up |
| 0.00–0.60 | Sequence scrubs. Title holds |
| 0.60–0.64 | Title cross-fades out over 200ms |
| 0.64 | Line fades in, centre-left, 32px Fraunces: *You were counting threads.* |
| 0.64–0.90 | Sequence continues. Line holds |
| 0.90–1.00 | Line fades. Section releases |

Title: **Toda Embroidery** 76px `--cloth`, then **The Side We Misread** 76px
`--red` on the line beneath.

A hairline scroll cue sits bottom-centre at 40% opacity, gone by progress 0.10.

**Correction 1 — scale: architecture → cloth.**

---

### 2 · About — 130vh, flowing, bg `--ink`

Two-column asymmetric spread. Text columns 2–6, plates columns 8–12.

**Signature move — the warp reveal.** Copy is masked by a `clip-path` of
vertical bars that widen on scroll, so text assembles as if being woven in,
column by column. Bars are `--cell` wide. This is CSS only.

Plates translate `y: -80` while text translates `y: -20` across the section.
That differential is the chapter's only other motion.

Eyebrow above the heading, mono, `--red`: `STITCHES 1,240 — 2,480` (values
derived from the registry, not hardcoded).

Content: the *putukuli*, what *pukhoor* signifies, that the embroidery marks
identity within the community rather than decorating a garment.

**Correction 2 — decoration → language.**

---

### 3 · Construction — 300vh, pinned, bg `--ink`

The longest hold on the site. Cloth centred, 720px wide.

| Progress | Event |
|---|---|
| 0.00–0.15 | Cloth settles, front face, embroidered band lit |
| 0.15–0.35 | Four annotation hairlines draw outward to the margins — 0.5px `--red`, labels 12px mono: thread count, carried floats, mirror axis, counted-warp method |
| 0.35–0.38 | Annotations fade out (nothing rides the rotation) |
| 0.38–0.65 | **The flip.** CSS 3D rotation on the horizontal axis, front and back images as the two faces of a rotating plane, scrubbed |
| 0.65–0.80 | Reverse face holds. New label set draws in. Pull line to the right, 28px: *The back is also a face.* |
| 0.80–1.00 | Cloth scales up and drifts left as a macro plate of the reverse rises from the right |

**Do not use a frame sequence here.** A rotation is a morph and image-to-video
destroys it. This chapter uses three stills: front and back are the two faces
of the CSS `transform: rotateX()` flip with `backface-visibility`, and a
separate reverse macro enters for the final move. Sharper, cheaper, and it
cannot warp.

**Correction 3 — front → back.**

---

### 4 · Motifs — 160vh, flowing, bg `--cloth`

Cloth floods the frame for the first time since the hero.

Four-column grid of plates, each 280×280 on `--cloth-lit`, 48px gutters.
Motif centred, name below in 15px Fraunces, note in 13px mono.

**The draw is figure-ground, not outline.** The real object reserves cream
shapes out of solid black and red fields — the pattern you read is often the
hole. So each motif draws its *field* and leaves the figure. Implement as an
SVG mask animated by `stroke-dasharray` on the field paths, red units first,
then black, at a rate derived from that motif's real unit count. A denser
motif genuinely takes longer.

Trigger when the plate crosses 75% viewport height. Hover holds one plate at
full opacity and drops the rest to 30% over 300ms.

Smallest chapter of the eight. That is the argument.

**Correction 4 — figure → ground.**

---

### 5 · The counted grid — 140vh, pinned, bg `--cloth`

Scroll stops. Canvas centred at 900×640.

A bare lattice appears — 40×28 cells at 22px, 0.5px lines in `--black` at 20%.

Click or drag to place stitches. **Mirror axis on by default:** every mark
appears on both sides of the vertical centre, because that is how the real
work behaves.

Right rail, 240px wide:
- red / black swatch toggle
- mirror axis toggle
- *reveal original* — ghosts the traced motif underneath at 20%
- reset
- download PNG

Corner readout, mono, tabular:

```
YOUR STITCHES        14
ONE PUTUKULI      9,400
```

The second number is `ctx.stitchTotal`. The cursor becomes a small thread tip
in this chapter and nowhere else.

**Correction 5 — your marks → their labour.**

---

### 6 · The Nilgiris — 160vh, flowing, bg `--slate`

72-frame sequence: mist drifting across still ridgelines, very slow push-in.
Mist is the one subject where generated motion outperforms parallax layers.

Text low-left, columns 1–4, 22px Fraunces, three short lines maximum, drifting
at its own rate. Almost no information. This is the breath between the
interactive and the human chapter.

This is the site's one departure from the three-ground palette, and it is
deliberate. Keep it short so it reads as an interval.

**Correction 6 — landscape → a named place.**

---

### 7 · Artisans — 140vh, flowing, bg `--ink`

Portrait plates 420×560, staggered so no two align: plate 1 at columns 2–5,
plate 2 at columns 7–10 offset 180px down, and so on.

**Hands and cloth only. No faces, ever.** Cropped at the wrist or forearm:
fingers holding tension, a needle mid-stitch, thread wound round a knuckle.
This is both the stronger image and the safer one.

Text beside each plate, 24px Fraunces, flat and short. No lyricism — the
grammar changes here from *the cloth does this* to *she made this*, and it
works because nothing decorates it.

**Correction 7 — anonymous → laboured.**

Note: with generated imagery the site cannot truthfully claim named
authorship. This chapter is about the *act* of labour; the authorship beat
lives in the credits, where it is true.

---

### 8 · Closing — 160vh, pinned, bg `--ink` → `--red-cloth`

72-frame sequence: a slow push back *in*, past where the hero began, until the
frame holds a single red thread against black.

| Progress | Event |
|---|---|
| 0.00–0.50 | Sequence scrubs inward. Light retreats |
| 0.50–0.80 | Thesis fades in, centred, 34px Fraunces, four lines, generous leading |
| 0.80–1.00 | Thesis lifts. Credits panel rises. Ground bleeds to `--red-cloth` |

Credits: two columns, 14px mono. Motif source, method, the stitch arithmetic
stated plainly (`47 units × 32 repeats × 6 bands`), and one paragraph naming
which imagery is generated and which is documentary.

Opening on structure and closing on a single strand is the arc. Ending a piece
about hidden authorship by disclosing your own is the strongest last beat
available.

---

## 8. The thread navigation

**One continuous SVG path** doing two jobs.

- Enters at the top-left corner of the viewport
- Runs horizontally across the top, 32px down, as the **navbar**
- Turns at the top-right on a small rounded arc — **not** a hard right angle,
  which reads as a border
- Descends the right edge, 40px in, as the **progress line**

Stroke 1.5px `--red`. `stroke-dasharray` set to total path length;
`stroke-dashoffset` driven directly by document scroll progress. The vertical
run is fully undrawn at the top of the page and complete at the closing.

**Knots:** one per chapter, derived from the registry. Positioned along the
horizontal run across its right two-thirds. 3.5px filled circles. Labels
beneath in 11px Space Grotesk, uppercase, 0.12em tracking, `--cloth` at 55%.

- Hover: knot swells to 6px, label to 100%. Nothing else moves.
- Click: Lenis scrolls to that chapter.
- The current chapter's knot stays lit.

**Counter:** IBM Plex Mono, tabular figures, sitting at the *head of the
growing vertical tip* — it travels down the edge as the thread stitches.
Reads `0` → `ctx.stitchTotal`.

**Weight modulation:** 2.5px through Construction, 1px through the Nilgiris.

**Idle:** after 8 seconds without scroll, the thread pulses once, slowly.

Add a chapter, a knot appears. Never touch this file again.

### Implemented deviations

The production thread navigation preserves the contract above with four
legibility refinements: the horizontal navbar and corner/vertical progress run
are separate strokes so weight modulation affects only progress; the loose
left tail begins at `x = 60px`; chapter knots are stroked overhand loops rather
than filled circles; and label/counter colours choose the higher WCAG contrast
against each active ground. The horizontal run remains a constant 1.5px
scarlet while only the vertical run changes weight.

---

## 9. Motion law

- Every narrative movement is driven by scroll and fully reversible: scroll up
  and the light retreats, the cloth flips back, the counter falls. The only
  timed elements are the film-grain flicker and the thread navigation's
  eight-second idle pulse.
- Entrances: `--ease-in`. Exits: `--ease-out`. Never GSAP's `power2.out`.
- Text enters **by line**: split into lines, clip-mask each, 60ms stagger.
- No plate is ever perfectly still — every static image gets a 6–10px drift
  over 8–12s.
- Chapter grounds bleed over 60vh. Never a hard cut.
- Nothing moves faster than the scroll. The target feel is a heavy drawer on
  good runners.

---

## 10. Sequence loader (`src/lib/sequence.ts`)

The hero's 96-frame array is built from two Kling clips. Sample 48 frames from
`hero-a` → `hero-b` and 48 from `hero-b` → `hero-c`, then concatenate them
directly. Do not cross-fade: the shared `hero-b` endpoint makes the join
frame-exact.

```ts
loadSequence(name: string, frameCount: number): Promise<HTMLImageElement[]>
```

- Loads `/assets/{name}/0001.webp` … through `frameCount`.
- Resolves only when every frame is decoded (`img.decode()`).
- Begins loading **two chapters ahead** of its own chapter, driven by
  `chapter.preload`.
- Draws to canvas with `cover` fit maths against the viewport.
- Only redraws when the rounded frame index changes:

```ts
const i = Math.min(frames.length - 1, Math.round(progress * (frames.length - 1)));
if (i !== current) { current = i; ctx.drawImage(frames[i], ...coverRect(frames[i])); }
```

- **Holds the last decoded frame** if the visitor outruns the loader. Never
  show an empty canvas.
- Never decode more than two sequences into memory at once; release the rest.

---

## 11. Constraints

### Asset manifest

The production pipeline has 22 stills and 4 Kling clips: 26 inputs in `raw/`.

| Asset group | Stills | Still source ratio | Clips | Clip source ratio |
|---|---:|---:|---:|---:|
| Hero | 3 | 3:2 | 2 | 16:9 |
| Construction | 3 | 4:5 | 0 | — |
| Motifs | 6 | 1:1 | 0 | — |
| Nilgiris | 1 | 3:2 | 1 | 16:9 |
| Closing | 2 | 3:2 | 1 | 16:9 |
| Artisans | 4 | 3:4 | 0 | — |
| Textures | 3 | 4:5 | 0 | — |
| **Total** | **22** | — | **4** | — |

Sequence extraction produces 240 frames: hero 96, Nilgiris 72 and closing 72.
Wide stills and clips are cropped to 21:9 during grading.

**Performance ceiling — enforce these:**
- Total transferred payload ≤ 12MB
- No sequence longer than 96 frames
- No more than 2 sequences decoded in memory simultaneously
- LCP under 2.5s

**Reduced motion** (`prefers-reduced-motion: reduce`): frame sequences hold on
a single representative frame; all drift stops; grain is disabled; the thread
still draws with scroll. This branches once in the engine — it must be in the
contract from the start, not retrofitted into eight modules.

**Mobile** (< 900px): a static hero frame, the title, and one line stating the
piece is built for desktop. Honest, not broken.

**Meta:** page title, description, OG image (use hero frame 0), favicon.

---

## 12. File tree

```
src/
  main.ts                  engine boot, registry read, ScrollTrigger setup
  constants.ts             STITCH_TOTAL and other derived constants
  chapters/
    index.ts               the registry array
    01-hero.ts
    02-about.ts
    03-construction.ts
    04-motifs.ts
    05-grid.ts
    06-nilgiris.ts
    07-artisans.ts
    08-closing.ts
  lib/
    types.ts               Chapter, ChapterContext
    sequence.ts            frame loader + canvas scrub
    thread-nav.ts          SVG path, knots, counter
    grid-engine.ts         counted-grid interactive
    preloader.ts           byte-counting gate
    lattice.ts
    grain.ts
    text-reveal.ts         line-split clip-mask helper
  motifs/
    *.svg                  traced from the real reference
  styles/
    tokens.css
    type.css
    base.css
scripts/
  grade.sh                 colour grade over raw/
  frames.sh                extract + webp convert
public/assets/
  hero/0001.webp … 0096.webp
  nilgiris/0001.webp … 0072.webp
  closing/0001.webp … 0072.webp
  construction/front.webp, back.webp, reverse-macro.webp
  motifs/*.webp
  artisans/*.webp
  textures/texture-cloth.webp, texture-red.webp, texture-folds.webp
  noise.png
raw/                       (gitignored) ungraded downloads from Magnific
reference/                 NOT shipped — working references only
  original/                the 9 source photographs of the real object
  crops/                   tight straightened crops used for generation
  trace-source.png         cropped isolated motif; source for the SVG trace
```

**Codex: on first run, sample the black and scarlet from `reference/original/`
and confirm they match `--black` and `--red` in §2. The token values are
eyeballed from these photographs; sampled values win.**

---

## 13. Build order

Build in this order. Do not skip ahead — each step is the foundation of the
next, and steps 1–5 require no assets to exist.

1. **Scaffold + tokens + lattice + grain + grade script.** The finished look
   exists before any asset does.
2. **Chapter contract + engine + registry**, with all eight chapters as flat
   colour blocks. Verify the dummy-chapter test from §5.
3. **Scroll the empty site.** Fix pacing here, while it costs nothing.
4. **`thread-nav.ts`** — navbar, knots, progress line, counter.
5. **`grid-engine.ts`** + trace the reference motif to SVG. The trace yields
   the real unit count, which sets `STITCH_TOTAL` in `constants.ts` and
   back-fills the counter and preloader.
6. **Generate assets** per `PROMPTS.md`. Run `grade.sh`, then `frames.sh`.
7. **Wire sequences into chapters.** The site becomes real.
8. **Insert copy.**
9. **Reduced motion, preloading, meta, mobile fallback. Deploy.**

---

## 14. Two things the spec cannot supply

- **The traced motif.** Until `STITCH_TOTAL` is derived from a real trace, it
  is a placeholder. State the arithmetic in the credits once it is real.
- **The copy.** Layouts are sized to specific text lengths. Write it in
  parallel with steps 1–5, not after step 7.
