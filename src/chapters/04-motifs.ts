import gsap from 'gsap';
import {
  finishTimeline,
  linkTopOcclusion,
  makeAssetImage,
  makeElement,
  mountTopOcclusion,
  scrubPlateDrift,
} from '../lib/chapter-utils';
import { MOTIFS_DEMO_CONTENT } from '../content/temporary-demo';
import { getMotifData, type MotifId } from '../lib/motif-data';
import { addBlockReveal, initBlockReveal } from '../lib/text-reveal';
import type { Chapter } from '../lib/types';

const MOTIF_COPY = [
  [
    'Stacked lozenge',
    'Off-white diamonds remain unstitched.',
    'Kaus Pohar',
  ],
  [
    'Four-petal repeat',
    'Off-white petals open inside scarlet.',
    'Peersh Pohar',
  ],
  [
    'Scalloped border',
    'Curled and heart-like forms edge the band.',
    'Venki',
  ],
  [
    'Diagonal cross',
    'Stepped arms turn through red and black.',
    'Flower',
  ],
  [
    'Diamond lattice',
    'Small cloth openings punctuate the crossings.',
    'Pohar',
  ],
  [
    'Chevron pair',
    'Two narrow bands divide at a plain stripe.',
    'Achak Pohoram',
  ],
] as const;

export const motifs: Chapter = {
  id: 'motifs',
  label: 'Motifs',
  scrollVh: 160,
  pinned: false,
  bg: 'var(--cloth)',
  stitches: 940,
  mount(el) {
    el.classList.add('motifs');
    const intro = makeElement('header', 'motifs__intro');
    intro.append(
      makeElement(
        'p',
        'type-label motifs__eyebrow',
        'CHAPTER 04 — THE PART EVERYONE SEES',
      ),
      makeElement(
        'h2',
        'type-heading motifs__heading',
        MOTIFS_DEMO_CONTENT.heading,
      ),
    );

    const grid = makeElement('div', 'motifs__grid');
    MOTIF_COPY.forEach(([name, note, localName], index) => {
      const motifId = (index + 1) as MotifId;
      const motif = getMotifData(motifId);
      const plate = makeElement('figure', 'motifs__plate');
      plate.dataset.motifId = String(motifId);
      plate.dataset.gridWidth = String(motif.width);
      plate.dataset.gridHeight = String(motif.height);
      plate.dataset.unitCount = String(motif.units.length);
      plate.dataset.drawDuration = String(
        Math.max(0.1, motif.units.length * 0.0024),
      );
      plate.dataset.authenticityStatus = 'verification-required';
      const imageShell = makeElement('div', 'motifs__image-shell');
      // Raster only — the analytical SVG stitch trace is no longer part
      // of the visitor experience. `motif-data.ts`'s `createMotifSvg()`
      // and the source `.svg` files are untouched and still importable
      // for future use; simply not calling it here means nothing is
      // mounted, nothing is queried, and nothing is animated for it —
      // no hidden per-unit GSAP tweens running for content that's never
      // shown.
      const raster = makeAssetImage(
        `/assets/motifs/${motifId}.webp`,
        `${name} Toda embroidery motif`,
        'motifs__image drift-plate',
      );
      imageShell.append(raster);
      const caption = makeElement('figcaption', 'motifs__caption');
      caption.append(
        makeElement('strong', 'type-caption', name),
        makeElement(
          'span',
          'motifs__local-name type-annotation',
          `Colloquial name — ${localName}`,
        ),
        makeElement('span', 'type-annotation', note),
      );
      plate.append(imageShell, caption);
      grid.append(plate);
    });

    const continuation = makeElement(
      'p',
      'motifs__continuation type-label',
      MOTIFS_DEMO_CONTENT.continuation,
    );
    continuation.dataset.contentStatus = 'temporary-demo';

    const footer = makeElement(
      'p',
      'motifs__footer type-body',
      MOTIFS_DEMO_CONTENT.closing,
    );
    footer.dataset.contentStatus = 'temporary-demo';
    // Whole-block reveal (not line-split): the closing sentence's hidden
    // state is applied synchronously here, before ScrollTrigger's first
    // render, so no fragment of it can be visible pre-reveal.
    initBlockReveal(footer, 10);

    // One rigid stack holding the label, grid and closing sentence
    // together. The surface itself isn't pinned, so it would otherwise
    // drift upward under normal scroll by the chapter's full excess
    // height (scrollVh - 100vh) — this wrapper is what the timeline
    // counter-drifts to keep the six-card grid in one fixed visual
    // position instead of scrolling row one behind the nav. Grouping
    // everything into a single transformed unit (rather than the grid
    // alone) means nothing can drift relative to anything else, so the
    // grid, its label and its closing sentence can never overlap.
    const stack = makeElement('div', 'motifs__stack');
    stack.append(intro, grid, continuation, footer);
    el.append(stack);

    const positionContinuation = () => {
      const plates = Array.from(
        grid.querySelectorAll<HTMLElement>('.motifs__plate'),
      );
      const secondRow = plates.slice(3);
      const secondRowTop = Math.min(
        ...secondRow.map((plate) => plate.offsetTop),
      );
      continuation.style.top = `${grid.offsetTop + secondRowTop - 26}px`;
      continuation.style.left = `${grid.offsetLeft}px`;
    };
    window.requestAnimationFrame(positionContinuation);
    window.addEventListener('resize', positionContinuation, { passive: true });
    void document.fonts.ready.then(positionContinuation);
    mountTopOcclusion('cloth');
  },
  timeline(tl, el, ctx) {
    const stack = el.querySelector<HTMLElement>('.motifs__stack');
    const intro = el.querySelector<HTMLElement>('.motifs__intro');
    const continuation = el.querySelector<HTMLElement>('.motifs__continuation');
    const footer = el.querySelector<HTMLElement>('.motifs__footer');
    const plates = Array.from(el.querySelectorAll<HTMLElement>('.motifs__plate'));
    const occlusion = document.querySelector<HTMLElement>(
      '.chapter-top-occlusion--cloth',
    );

    if (occlusion) {
      // Motifs follows Construction, a pinned chapter whose own image
      // handoff choreography completes exactly as its pin releases —
      // the default trigger start lands right at that release point,
      // leaving Construction's release-tail content no room to clear the
      // nav before this cream occlusion snapped in on top of it (visible
      // as a solid cream band cutting across Construction's still-active
      // imagery). Delaying the start most of the way through that tail
      // gives it room to scroll clear first.
      linkTopOcclusion(occlusion, el, { startDelayVh: 85 });
    }

    // The surface isn't pinned, so it drifts upward under normal scroll
    // by (chapterHeight - viewportHeight) over the full 0-1 range.
    // Counter-drift the whole stack to hold it at its natural mount-time
    // position through the reveal and hold (0-0.86), so the six-card
    // grid never moves and row one never scrolls behind the nav, then
    // release the compensation smoothly over 0.86-1.00 so the stack
    // hands off to its natural (fully drifted) position for the existing
    // exit into Grid.
    if (stack) {
      const HOLD_END = 0.86;
      const driftAmountPerProgress = () =>
        (window.innerHeight * (motifs.scrollVh - 100)) / 100;
      const driver = { p: 0 };

      tl.to(
        driver,
        {
          p: 1,
          duration: 1,
          ease: 'none',
          onUpdate: () => {
            const p = driver.p;
            const drift = driftAmountPerProgress();
            const compensation =
              p <= HOLD_END
                ? p * drift
                : HOLD_END * drift * (1 - (p - HOLD_END) / (1 - HOLD_END));

            gsap.set(stack, { y: compensation });
          },
        },
        0,
      );
    }

    // One master, chapter-progress-scrubbed timeline instead of six
    // independent per-plate ScrollTriggers: every card owns a fixed grid
    // cell throughout (no absolute stacking, no z-index changes), so this
    // only ever sequences *when* each card's opacity/trace draws in, never
    // where it sits — nothing can visually land on another card.
    if (intro) {
      tl.fromTo(
        intro,
        { opacity: 0 },
        { opacity: 1, duration: 0.1, ease: 'none' },
        0,
      );
    }

    // Raster only: opacity 0->1 and a maximum 8px lift only — no scale,
    // no horizontal movement, no blur, no shadow. Once settled, nothing
    // is scheduled again for this card, so it stays fixed until exit.
    const revealPlate = (plate: HTMLElement, start: number, duration: number) => {
      tl.fromTo(
        plate,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration, ease: 'none' },
        start,
      );
    };

    const row1 = plates.slice(0, 3);
    const row1Start = 0.1;
    const row1Span = 0.2; // 0.10-0.30
    row1.forEach((plate, index) => {
      revealPlate(plate, row1Start + (row1Span / 3) * index, row1Span / 3);
    });

    // 0.30-0.36 holds row one fully visible (nothing scheduled).

    if (continuation) {
      tl.fromTo(
        continuation,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.06, ease: 'none' },
        0.36,
      );
    }

    const row2 = plates.slice(3, 6);
    const row2Start = 0.4;
    const row2Span = 0.22; // 0.40-0.62
    row2.forEach((plate, index) => {
      revealPlate(plate, row2Start + (row2Span / 3) * index, row2Span / 3);
    });

    // 0.62-0.76 holds with all six cards fully settled (nothing scheduled).

    if (footer) {
      addBlockReveal(tl, footer, { position: 0.76, duration: 0.1, translateY: 10 });
      // The complete sentence is fully readable by 0.86; the approved
      // exit into Grid over 0.86-1.00 is unchanged.
    }

    scrubPlateDrift(tl, el, ctx.reducedMotion);
    finishTimeline(tl, el);
  },
};
