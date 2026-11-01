import {
  finishTimeline,
  makeElement,
  makeSequenceCanvas,
  scrubSequence,
} from '../lib/chapter-utils';
import { addBlockReveal, addTextReveal, initBlockReveal } from '../lib/text-reveal';
import type { Chapter } from '../lib/types';

// Small residual settle for the copy block — kept far under the old
// 60vh-tall drift so the block reads as anchored, not travelling.
const NILGIRIS_COPY_DRIFT_Y = 12;

export const nilgiris: Chapter = {
  id: 'nilgiris',
  label: 'Nilgiris',
  scrollVh: 160,
  pinned: false,
  // Matches the surface's own #0B0B0C background exactly: the surface
  // is only 100vh tall inside this 160vh (non-pinned) chapter, so once
  // it drifts under normal scroll the body's own interpolated
  // background shows in the gap beyond it — using the same dark tone
  // here means that gap is invisible instead of showing as a strip in
  // the previous --slate (blue-grey) colour.
  bg: 'var(--ink)',
  stitches: 611,
  preload: ['nilgiris'],
  mount(el) {
    el.classList.add('nilgiris');
    const stage = makeElement('div', 'nilgiris__stage');
    const canvasWrap = makeElement('div', 'nilgiris__canvas-wrap');
    const canvas = makeSequenceCanvas(
      'Mist moving across the grassland ridges of the Nilgiris',
    );
    canvas.classList.add('nilgiris__canvas');
    canvasWrap.append(canvas);
    const protection = makeElement('div', 'nilgiris__protection');
    protection.setAttribute('aria-hidden', 'true');
    const copy = makeElement('div', 'nilgiris__copy');
    copy.append(
      makeElement(
        'p',
        'nilgiris__eyebrow type-label',
        'CHAPTER 06 — WHERE',
      ),
      makeElement(
        'p',
        'nilgiris__line type-pull',
        'High on the Nilgiri plateau, frost helps shape the grassland.',
      ),
      makeElement(
        'p',
        'nilgiris__line type-pull',
        'The poothkuli is a substantial shawl worn in this cool upland climate.',
      ),
      makeElement(
        'p',
        'nilgiris__line type-pull',
        'Place is part of the cloth’s story.',
      ),
    );
    stage.append(canvasWrap, protection, copy);
    el.append(stage);

    // Whole-block reveal (not line-split): each paragraph's hidden state
    // is applied synchronously here, before ScrollTrigger's first render,
    // so no later line can leak ahead of its own paragraph's reveal.
    copy
      .querySelectorAll<HTMLElement>('.nilgiris__line')
      .forEach((line) => initBlockReveal(line, 10));
  },
  timeline(tl, el, ctx) {
    const canvas = el.querySelector<HTMLCanvasElement>('.nilgiris__canvas');
    const canvasWrap = el.querySelector<HTMLElement>('.nilgiris__canvas-wrap');
    const copy = el.querySelector<HTMLElement>('.nilgiris__copy');
    const eyebrow = el.querySelector<HTMLElement>('.nilgiris__eyebrow');
    const lines = el.querySelectorAll<HTMLElement>('.nilgiris__line');

    // `.nilgiris` (el) is the element with `overflow: hidden` — it is
    // the actual clip boundary for everything inside it, including the
    // canvas. The chapter isn't pinned, so `el` itself drifts upward
    // under normal scroll by the chapter's full excess height; counter-
    // drifting a child (e.g. `.nilgiris__stage`) instead of `el` was the
    // previous bug — the child's rendered box could be repositioned
    // back to (0,900), but `el`'s own box (the thing overflow:hidden
    // actually clips against) kept drifting away underneath it,
    // silently clipping the bottom of the sequence more and more as
    // scroll progressed (confirmed via elementsFromPoint: the canvas
    // dropped out of hit-testing well above the visual viewport edge).
    // Transforming `el` itself keeps the clip boundary and its content
    // moving together, so nothing gets clipped.
    const driftAmountPerProgress = () =>
      (window.innerHeight * (nilgiris.scrollVh - 100)) / 100;

    tl.fromTo(
      el,
      { y: 0 },
      {
        y: () => driftAmountPerProgress(),
        duration: 1,
        ease: 'none',
      },
      0,
    );

    if (canvas) {
      scrubSequence(
        tl,
        canvas,
        'nilgiris',
        72,
        0,
        1,
        ctx.reducedMotion,
        36,
      );
    }

    if (canvasWrap && !ctx.reducedMotion) {
      // Transform only: a restrained scale-only zoom on the wrapper, not
      // the canvas element itself, and no translation — the canvas
      // always fills its wrapper exactly, so nothing ever exposes the
      // surface behind it.
      tl.fromTo(
        canvasWrap,
        { scale: 1.02 },
        { scale: 1.08, duration: 0.88, ease: 'none' },
        0,
      );
      // 0.88-1.00 holds scale 1.08 (nothing scheduled).
    }

    if (copy) {
      tl.fromTo(
        copy,
        { y: NILGIRIS_COPY_DRIFT_Y },
        { y: 0, duration: 1, ease: 'none' },
        0,
      );

      if (eyebrow) {
        addTextReveal(tl, eyebrow, { position: 0.04, duration: 0.06 });
      }

      // Each paragraph reveals top-to-bottom as one clipped block, fully
      // settling before the next paragraph's window begins — no
      // per-line splitting, so nothing can appear out of order.
      const paragraphRanges: Array<[number, number]> = [
        [0.08, 0.22],
        [0.22, 0.36],
        [0.36, 0.48],
      ];

      lines.forEach((line, index) => {
        const [start, end] = paragraphRanges[index] ?? [0.08, 0.22];
        addBlockReveal(tl, line, {
          position: start,
          duration: end - start,
          translateY: 10,
        });
      });

      // 0.74-0.88: the whole copy group exits together.
      tl.to(
        copy,
        { opacity: 0, duration: 0.14, ease: 'none' },
        0.74,
      );
    }

    finishTimeline(tl, el);
  },
};
