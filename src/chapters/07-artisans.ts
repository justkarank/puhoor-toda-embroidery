import gsap from 'gsap';
import {
  finishTimeline,
  makeAssetImage,
  makeElement,
  scrubPlateDrift,
} from '../lib/chapter-utils';
import { ARTISANS_DEMO_CONTENT } from '../content/temporary-demo';
import { addBlockReveal, initBlockReveal } from '../lib/text-reveal';
import type { Chapter } from '../lib/types';

const ARTISAN_COPY = [
  'The work advances thread by thread. Larger pieces can take weeks to complete.',
  'The thread is held under careful tension so the ground stays even.',
  ARTISANS_DEMO_CONTENT.thirdCaption,
  ARTISANS_DEMO_CONTENT.fourthCaption,
] as const;

const IMAGE_OPACITY_ACTIVE = 1;
const IMAGE_OPACITY_PREVIOUS = 0.28;
// Upcoming plates start fully hidden (not dimly visible): the visitor
// should never see a future plate before its own activation window.
const IMAGE_OPACITY_UPCOMING = 0;
const CAPTION_OPACITY_INACTIVE = 0;
const BEAT = 0.04;
const ROW_TRANSITION_START = 0.46;
const ROW_TRANSITION_END = 0.54;

export const artisans: Chapter = {
  id: 'artisans',
  label: 'The Maker',
  scrollVh: 180,
  pinned: false,
  bg: 'var(--ink)',
  stitches: 1_222,
  mount(el) {
    el.classList.add('artisans');
    const stage = makeElement('div', 'artisans__stage');
    const header = makeElement('header', 'artisans__header');
    const eyebrow = makeElement(
      'p',
      'type-label artisans__eyebrow',
      `CHAPTER 07 — ${ARTISANS_DEMO_CONTENT.chapterTitle}`,
    );
    const heading = makeElement(
      'h2',
      'type-heading artisans__heading',
      ARTISANS_DEMO_CONTENT.heading,
    );
    const name = makeElement(
      'p',
      'artisans__name type-annotation',
      ARTISANS_DEMO_CONTENT.name,
    );
    const attribution = makeElement(
      'h3',
      'artisans__attribution type-label',
      ARTISANS_DEMO_CONTENT.attribution,
    );
    header.append(eyebrow, heading, name, attribution);

    // The zone is the one clip boundary for the image track: it is sized
    // to exactly one row's content height, so the inactive row's plates
    // sit entirely outside its box (not merely behind a lower z-index or
    // a transparent gap) whenever they are not the active row. This is
    // what makes leakage geometrically impossible rather than merely
    // timed around.
    const zone = makeElement('div', 'artisans__zone');
    const track = makeElement('div', 'artisans__track');

    ARTISAN_COPY.forEach((copy, index) => {
      const plate = makeElement(
        'figure',
        `artisans__plate artisans__plate--${index + 1}`,
      );
      plate.style.opacity = String(IMAGE_OPACITY_UPCOMING);
      plate.append(
        makeAssetImage(
          `/assets/artisans/${index + 1}.webp`,
          `Hands working counted embroidery, study ${index + 1}`,
          'artisans__image drift-plate',
        ),
        makeElement('figcaption', 'artisans__caption type-pull', copy),
      );
      if (index >= 2) {
        plate.querySelector('figcaption')?.setAttribute(
          'data-content-status',
          'temporary-demo',
        );
      }
      track.append(plate);
    });
    zone.append(track);

    const closingLine = makeElement(
      'p',
      'artisans__closing type-body',
      ARTISANS_DEMO_CONTENT.closing,
    );
    closingLine.dataset.contentStatus = 'temporary-demo-cultural-review';
    stage.append(header, zone, closingLine);
    el.append(stage);

    // Whole-block reveal (not line-split): hidden state applied
    // synchronously here, before ScrollTrigger's first render, so nothing
    // — chapter label, heading, artisan meta, captions, or the closing
    // statement — can be visible for even one frame ahead of its own
    // reveal window. Plates get their own hidden opacity set inline above
    // for the same reason.
    track
      .querySelectorAll<HTMLElement>('.artisans__caption')
      .forEach((caption) => initBlockReveal(caption, 8));
    initBlockReveal(closingLine, 8);
    initBlockReveal(eyebrow, 6);
    initBlockReveal(heading, 8);
    initBlockReveal(name, 6);
    initBlockReveal(attribution, 6);
  },
  timeline(tl, el, ctx) {
    const eyebrow = el.querySelector<HTMLElement>('.artisans__eyebrow');
    const heading = el.querySelector<HTMLElement>('.artisans__heading');
    const name = el.querySelector<HTMLElement>('.artisans__name');
    const attribution = el.querySelector<HTMLElement>('.artisans__attribution');
    const zone = el.querySelector<HTMLElement>('.artisans__zone');
    const track = el.querySelector<HTMLElement>('.artisans__track');
    const plates = el.querySelectorAll<HTMLElement>('.artisans__plate');
    const captions = el.querySelectorAll<HTMLElement>('.artisans__caption');
    const closingLine = el.querySelector<HTMLElement>('.artisans__closing');

    // The chapter surface is not pinned, so `el` itself (the thing
    // `overflow: hidden` in .artisans actually clips against) drifts
    // upward under normal page scroll by `chapterHeight - viewportHeight`
    // over the full 0-1 range. Counter-drifting `el` directly — the same
    // fix already proven in Nilgiris — keeps the whole stage (header,
    // zone, closing line) genuinely stationary on screen, rather than
    // leaving each piece to compensate (or fail to) on its own.
    const driftAmountPerProgress = () =>
      (window.innerHeight * (artisans.scrollVh - 100)) / 100;
    tl.fromTo(
      el,
      { y: 0 },
      { y: () => driftAmountPerProgress(), duration: 1, ease: 'none' },
      0,
    );

    // 0.00-0.10: chapter label, heading, and artisan meta reveal in order
    // as whole blocks (no line-splitting) — settled by 0.10, before any
    // plate is shown.
    if (eyebrow) {
      addBlockReveal(tl, eyebrow, { position: 0, duration: 0.04, translateY: 6 });
    }
    if (heading) {
      addBlockReveal(tl, heading, { position: 0.03, duration: 0.05, translateY: 8 });
    }
    if (name) {
      addBlockReveal(tl, name, { position: 0.06, duration: 0.03, translateY: 6 });
    }
    if (attribution) {
      addBlockReveal(tl, attribution, { position: 0.07, duration: 0.03, translateY: 6 });
    }

    // One master timeline; only one storytelling state changes at a time.
    // Each plate: activates (0.04), its caption reveals (0.04), then a
    // true hold where nothing is scheduled — opacity, transform and
    // captions all stay bit-for-bit constant — before the next plate's
    // own window opens.
    const platePhases: Array<{
      activeStart: number;
      captionStart: number;
      dimStart: number;
    }> = [
      { activeStart: 0.1, captionStart: 0.14, dimStart: 0.3 },
      { activeStart: 0.3, captionStart: 0.34, dimStart: ROW_TRANSITION_START },
      { activeStart: 0.54, captionStart: 0.58, dimStart: 0.7 },
      { activeStart: 0.7, captionStart: 0.74, dimStart: 0.86 },
    ];

    plates.forEach((plate, index) => {
      const phase = platePhases[index];

      tl.fromTo(
        plate,
        { opacity: IMAGE_OPACITY_UPCOMING, y: 6 },
        { opacity: IMAGE_OPACITY_ACTIVE, y: 0, duration: BEAT, ease: 'none' },
        phase.activeStart,
      );

      const caption = captions[index];
      if (caption) {
        addBlockReveal(tl, caption, {
          position: phase.captionStart,
          duration: BEAT,
          translateY: 8,
        });
      }

      // Plate dims to the quiet "previously shown" state in the same
      // window the next plate activates (or, for plate 4, the dedicated
      // "plates settle quiet" window before the final statement). The
      // caption dims fully to 0 in that same window — never lingering
      // above the 0.20 ceiling while another caption is revealing, since
      // the next caption's own reveal window starts only once this one
      // has finished.
      tl.to(
        plate,
        { opacity: IMAGE_OPACITY_PREVIOUS, duration: BEAT, ease: 'none' },
        phase.dimStart,
      );
      if (caption) {
        tl.to(
          caption,
          { opacity: CAPTION_OPACITY_INACTIVE, duration: BEAT, ease: 'none' },
          phase.dimStart,
        );
      }
    });

    // Measured, cached row-anchor system: the track's own `y` is the one
    // transform owner for the image row. `row1AnchorY`/`row2AnchorY` are
    // measured once from layout (`offsetTop`, unaffected by the track's
    // own transform or by `el`'s counter-drift) and cached; the row
    // transition interpolates only between those two measured anchors,
    // recalculated on resize / web-font load, never read on every scroll
    // frame.
    if (track && zone) {
      let row1AnchorY = 0;
      let row2AnchorY = 0;

      const measureAnchors = () => {
        const row1Plate = plates[0];
        const row2Plate = plates[2];
        row1AnchorY = row1Plate ? -row1Plate.offsetTop : 0;
        row2AnchorY = row2Plate ? -row2Plate.offsetTop : 0;
      };

      const measureZone = () => {
        const clearance =
          Number.parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue(
              '--thread-nav-content-clearance',
            ),
          ) || 76;
        const zoneTop = clearance + 60;
        const bottomGap = window.innerHeight <= 800 ? 24 : 32;
        const available = Math.max(0, window.innerHeight - zoneTop - bottomGap);
        const contentHeight =
          Math.max(0, ...Array.from(plates).map((plate) => plate.offsetHeight)) + 16;
        zone.style.top = `${zoneTop}px`;
        zone.style.height = `${Math.min(contentHeight, available)}px`;
      };

      const measureAll = () => {
        measureZone();
        measureAnchors();
      };

      measureAll();
      window.addEventListener('resize', measureAll, { passive: true });
      void document.fonts.ready.then(measureAll);

      const rowDriver = { p: 0 };
      tl.to(
        rowDriver,
        {
          p: 1,
          duration: 1,
          ease: 'none',
          onUpdate: () => {
            const p = rowDriver.p;
            let y: number;

            if (p <= ROW_TRANSITION_START) {
              y = row1AnchorY;
            } else if (p >= ROW_TRANSITION_END) {
              y = row2AnchorY;
            } else {
              const t = (p - ROW_TRANSITION_START) / (ROW_TRANSITION_END - ROW_TRANSITION_START);
              y = row1AnchorY + (row2AnchorY - row1AnchorY) * t;
            }

            gsap.set(track, { y });
          },
        },
        0,
      );
    }

    if (closingLine) {
      // The final maker statement's vertical position is held fixed
      // against the safe viewport region below (measured, like the row
      // anchors) rather than left to the CSS `bottom` offset alone, which
      // would clip at shorter viewports. `el`'s own counter-drift already
      // keeps this stationary against scroll; only the reveal's settle
      // motion is layered on top.
      let closingAnchorOffset = 0;

      const measureClosingAnchor = () => {
        const bottomGap = window.innerHeight <= 800 ? 24 : 32;
        const safeBottom = window.innerHeight - bottomGap;
        const naturalBottom = closingLine.offsetTop + closingLine.offsetHeight;
        closingAnchorOffset = safeBottom - naturalBottom;
      };

      measureClosingAnchor();
      window.addEventListener('resize', measureClosingAnchor, { passive: true });
      void document.fonts.ready.then(measureClosingAnchor);

      // 0.86-0.90: plates have already settled quiet (see dimStart above).
      // 0.90-0.94: the final statement reveals. 0.94-0.98: full readable
      // hold (nothing scheduled past the reveal).
      tl.set(closingLine, { visibility: 'visible' }, 0.9);
      tl.fromTo(
        closingLine,
        { opacity: 0, clipPath: 'inset(0 0 100% 0)' },
        { opacity: 1, clipPath: 'inset(0 0 0% 0)', duration: BEAT, ease: 'none' },
        0.9,
      );

      const closingDriver = { p: 0 };
      tl.to(
        closingDriver,
        {
          p: 1,
          duration: 1,
          ease: 'none',
          onUpdate: () => {
            const p = closingDriver.p;
            const settleT = Math.min(1, Math.max(0, (p - 0.9) / BEAT));
            const settleY = 8 * (1 - settleT);
            gsap.set(closingLine, { y: closingAnchorOffset + settleY });
          },
        },
        0,
      );
    }

    scrubPlateDrift(tl, el, ctx.reducedMotion);
    finishTimeline(tl, el);
  },
};
