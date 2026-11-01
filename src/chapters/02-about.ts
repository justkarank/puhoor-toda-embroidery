import {
  finishTimeline,
  linkTopOcclusion,
  makeAssetImage,
  makeElement,
  mountTopOcclusion,
  scrubPlateDrift,
} from '../lib/chapter-utils';
import { ABOUT_DEMO_CONTENT } from '../content/temporary-demo';
import { addBlockReveal, initBlockReveal } from '../lib/text-reveal';
import type { Chapter } from '../lib/types';

// Maximum translateY for any paragraph-wrapper reveal, per the approved
// whole-block reveal system (no per-line/per-word measurement, which can
// desync from the text's real post-font-load layout and read as
// fragmented glyphs).
const REVEAL_TRANSLATE_Y = 8;

// All text is fully readable by this point; the composition then holds
// completely still until the exit begins.
const READ_BY = 0.21;
const HOLD_END = 0.72;

// Small counter-drift that slows the copy/plates' apparent scroll speed.
// Kept well under the fixed nav's clearance band so content never lingers
// beneath it as the chapter scrolls past.
const ABOUT_DRIFT_Y = 64;

export const about: Chapter = {
  id: 'about',
  label: 'About',
  scrollVh: 130,
  pinned: false,
  bg: 'var(--ink)',
  stitches: 1_222,
  mount(el) {
    el.classList.add('about');
    const copy = makeElement('article', 'about__copy');
    const eyebrow = makeElement(
      'p',
      'about__eyebrow type-annotation',
      'CHAPTER 02 — WHAT THE CLOTH SAYS',
    );
    const heading = makeElement(
      'h2',
      'about__heading type-heading',
      'Not a pattern. A language.',
    );
    const body = makeElement('div', 'about__body');
    const introduction = makeElement(
      'p',
      'about__paragraph about__paragraph--intro type-body',
      ABOUT_DEMO_CONTENT.introduction,
    );
    introduction.dataset.contentStatus = 'temporary-demo';
    body.append(introduction);
    [
      'On the Nilgiri plateau, Toda people wear a draped shawl commonly transliterated as poothkuli. Its coarse cotton ground carries bands of red and black counted-thread embroidery, traditionally made by Toda women.',
      'The embroidery is commonly transliterated as pukhoor or pugur. It is built by counting the warp and weft of the cloth, without a traced design. At first glance it can look woven rather than embroidered.',
      'Its motifs draw on Toda life and the Nilgiri landscape. Poothkuli are worn at important social and ceremonial occasions, including weddings and funerals.',
    ].forEach((paragraph) => {
      body.append(
        makeElement('p', 'about__paragraph type-body', paragraph),
      );
    });
    copy.append(eyebrow, heading, body);

    // Whole-block reveal for every text element (not line-split): the
    // hidden state is applied synchronously here, before ScrollTrigger's
    // first render, so nothing can flash visible ahead of its own window
    // and no fragment of a later line can desync from a late web-font
    // swap the way per-line measurement could.
    [eyebrow, heading, ...Array.from(body.querySelectorAll<HTMLElement>('.about__paragraph'))].forEach(
      (target) => initBlockReveal(target, REVEAL_TRANSLATE_Y),
    );

    const plates = makeElement('div', 'about__plates');
    const cloth = makeAssetImage(
      '/assets/textures/texture-cloth.webp',
      'Open undyed handloom cloth',
      'about__plate about__plate--cloth drift-plate',
    );
    const folds = makeAssetImage(
      '/assets/textures/texture-folds.webp',
      'Folded coarse handloom cloth',
      'about__plate about__plate--folds drift-plate',
    );
    const clothCaption = makeElement(
      'p',
      'about__plate-caption type-caption',
      'The bands run the length of the cloth.',
    );
    const foldsCaption = makeElement(
      'p',
      'about__plate-caption type-caption',
      'Red and black thread on an off-white cotton ground.',
    );
    plates.append(cloth, clothCaption, folds, foldsCaption);
    el.append(copy, plates);

    // Plates' height is measured from copy's rendered height directly
    // (a plain DOM write, not a GSAP-managed scrubbed-tween value) so it
    // can never be re-evaluated mid-scroll. Previously this was a GSAP
    // .set() with a function value, which GSAP only re-resolves when
    // invalidated — the one invalidateOnRefresh pass at boot runs before
    // this chapter's own timeline is active (its ScrollTrigger hasn't
    // rendered yet), so the corrected (post-font-load) height was only
    // ever applied the first time the chapter actually entered — a
    // visible snap on the very first Hero->About scroll.
    const positionPlatesHeight = () => {
      plates.style.height = `${copy.offsetHeight || plates.offsetHeight}px`;
    };
    window.requestAnimationFrame(positionPlatesHeight);
    window.addEventListener('resize', positionPlatesHeight, { passive: true });
    void document.fonts.ready.then(positionPlatesHeight);
    mountTopOcclusion('ink');
  },
  timeline(tl, el, ctx) {
    const copy = el.querySelector<HTMLElement>('.about__copy');
    const plates = el.querySelector<HTMLElement>('.about__plates');
    const eyebrow = el.querySelector<HTMLElement>('.about__eyebrow');
    const heading = el.querySelector<HTMLElement>('.about__heading');
    const introduction = el.querySelector<HTMLElement>(
      '.about__paragraph--intro',
    );
    const bodyParagraphs = el.querySelectorAll<HTMLElement>(
      '.about__paragraph:not(.about__paragraph--intro)',
    );
    const occlusion = document.querySelector<HTMLElement>(
      '.chapter-top-occlusion--ink',
    );

    if (occlusion) {
      linkTopOcclusion(occlusion, el);
    }

    if (copy) {
      if (ctx.reducedMotion) {
        tl.set(copy, { '--warp-open': '22px' }, 0);
        tl.fromTo(
          copy,
          { y: 10 },
          {
            y: ABOUT_DRIFT_Y,
            duration: 1,
            ease: 'none',
          },
          0,
        );
      } else {
        // The warp mask's own repeating-stripe pattern reads as striped,
        // fragmented glyphs while it animates open — the exact defect
        // being fixed here — so it is opened instantly rather than
        // animated. Reveal now comes only from each block's own
        // clip/opacity/translateY tween.
        tl.set(copy, { '--warp-open': '22px' }, 0);
        // Entrance settle only, 0-0.21 (paired with the reveal) — the
        // hold and release below take over from here.
        const copyEnd = ABOUT_DRIFT_Y - 4;
        const copyEntranceY = 10 + (copyEnd - 10) * READ_BY;
        tl.fromTo(
          copy,
          { y: 10 },
          { y: copyEntranceY, duration: READ_BY, ease: 'none' },
          0,
        );
      }
    }

    if (plates) {
      if (ctx.reducedMotion) {
        tl.fromTo(
          plates,
          { y: 0 },
          { y: ABOUT_DRIFT_Y, duration: 1, ease: 'none' },
          0,
        );
      } else {
        const platesEnd = ABOUT_DRIFT_Y - 4;
        const platesEntranceY = platesEnd * READ_BY;
        tl.fromTo(
          plates,
          { y: 0 },
          { y: platesEntranceY, duration: READ_BY, ease: 'none' },
          0,
        );
      }
    }

    // TRUE viewport-space hold, 0.21-0.72. About is not pinned, so its
    // content keeps moving with the page's own natural scroll regardless
    // of what any GSAP-driven `y` value does — freezing that value does
    // NOT freeze the on-screen position, since the underlying document
    // is still scrolling underneath it at (viewportHeight * (scrollVh -
    // 100) / 100) px per unit of chapter progress. The only way to keep
    // the composition genuinely stationary on screen is to keep GROWING
    // the counter-offset at exactly that same rate for the whole hold
    // window — full 1:1 cancellation, not a frozen value. `copy` and
    // `plates` share this one `drift` constant as their single source of
    // truth for how much counter-motion the hold requires; each then
    // blends its own accumulated offset back down to its original
    // (pre-hold) exit value over 0.72-1.00, continuously — never removed
    // in one step, so nothing snaps the instant the hold releases.
    if (!ctx.reducedMotion && (copy || plates)) {
      const drift = (window.innerHeight * (about.scrollVh - 100)) / 100;
      const holdPeakOffset = drift * (HOLD_END - READ_BY);
      const copyEnd = ABOUT_DRIFT_Y - 4;
      const copyEntranceY = 10 + (copyEnd - 10) * READ_BY;
      const platesEnd = ABOUT_DRIFT_Y - 4;
      const platesEntranceY = platesEnd * READ_BY;

      if (copy) {
        tl.to(
          copy,
          {
            y: copyEntranceY + holdPeakOffset,
            duration: HOLD_END - READ_BY,
            ease: 'none',
          },
          READ_BY,
        );
        tl.to(
          copy,
          { y: copyEnd, duration: 1 - HOLD_END, ease: 'none' },
          HOLD_END,
        );
      }

      if (plates) {
        tl.to(
          plates,
          {
            y: platesEntranceY + holdPeakOffset,
            duration: HOLD_END - READ_BY,
            ease: 'none',
          },
          READ_BY,
        );
        tl.to(
          plates,
          { y: platesEnd, duration: 1 - HOLD_END, ease: 'none' },
          HOLD_END,
        );
      }
    }

    // Whole-block reveals only (no line-splitting, no per-word
    // measurement): label and heading settle first, then each paragraph
    // reveals as one complete clipped block in its own window, all
    // finishing well inside the 0.21 reading deadline. Nothing is
    // scheduled again until the 0.72-1.00 exit, so the composition holds
    // completely stable — fully readable, no movement, no opacity change
    // — for the entire 0.21-0.72 span.
    if (eyebrow) {
      addBlockReveal(tl, eyebrow, {
        position: 0,
        duration: 0.06,
        translateY: REVEAL_TRANSLATE_Y,
      });
    }

    if (heading) {
      addBlockReveal(tl, heading, {
        position: 0,
        duration: 0.1,
        translateY: REVEAL_TRANSLATE_Y,
      });
    }

    if (introduction) {
      addBlockReveal(tl, introduction, {
        position: 0,
        duration: 0.1,
        translateY: REVEAL_TRANSLATE_Y,
      });
    }

    bodyParagraphs.forEach((paragraph, index) => {
      addBlockReveal(tl, paragraph, {
        position: 0.07 + index * 0.04,
        duration: 0.06,
        translateY: REVEAL_TRANSLATE_Y,
      });
    });

    scrubPlateDrift(tl, el, ctx.reducedMotion);
    finishTimeline(tl, el);
  },
};
