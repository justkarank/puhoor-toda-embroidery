import {
  finishTimeline,
  makeAssetImage,
  makeElement,
  scrubPlateDrift,
} from '../lib/chapter-utils';
import { CONSTRUCTION_DEMO_CONTENT } from '../content/temporary-demo';
import { addTextReveal } from '../lib/text-reveal';
import type { Chapter } from '../lib/types';

const FRONT_NOTES = CONSTRUCTION_DEMO_CONTENT.labels;

function makeNotes(className: string, labels: readonly string[]): HTMLElement {
  const group = makeElement('div', className);
  group.dataset.contentStatus = 'temporary-demo';

  labels.forEach((label, index) => {
    const note = makeElement(
      'div',
      `construction__note construction__note--${index + 1}`,
    );
    const noteIndex = makeElement(
      'span',
      'construction__note-index',
      String(index + 1).padStart(2, '0'),
    );
    noteIndex.setAttribute('aria-hidden', 'true');
    const noteLabel = makeElement(
      'span',
      'construction__note-label type-annotation',
      label,
    );
    const leader = makeElement('span', 'construction__note-leader');
    leader.setAttribute('aria-hidden', 'true');
    note.append(noteIndex, noteLabel, leader);
    group.append(note);
  });

  return group;
}

export const construction: Chapter = {
  id: 'construction',
  label: 'Construction',
  scrollVh: 300,
  pinned: true,
  bg: 'var(--ink)',
  stitches: 2_209,
  mount(el) {
    el.classList.add('construction');
    const stage = makeElement('div', 'construction__stage');
    const header = makeElement('header', 'construction__header');
    header.append(
      makeElement(
        'p',
        'construction__eyebrow type-label',
        'CHAPTER 03 — WHAT YOU CANNOT SEE',
      ),
      makeElement(
        'h2',
        'construction__heading type-heading',
        CONSTRUCTION_DEMO_CONTENT.heading,
      ),
    );
    header.dataset.contentStatus = 'temporary-demo';
    const cloth = makeElement('div', 'construction__cloth');
    const plane = makeElement('div', 'construction__plane');
    const front = makeElement('div', 'construction__face construction__face--front');
    const back = makeElement('div', 'construction__face construction__face--back');
    front.append(
      makeAssetImage(
        '/assets/construction/front.webp',
        'Front face of a counted embroidered band',
        'construction__image drift-plate',
      ),
    );
    back.append(
      makeAssetImage(
        '/assets/construction/back.webp',
        'Reverse face showing carried floats and knots',
        'construction__image drift-plate',
      ),
    );
    plane.append(front, back);
    const clothOverlay = makeElement('div', 'construction__cloth-overlay');
    clothOverlay.setAttribute('aria-hidden', 'true');
    cloth.append(plane, clothOverlay);

    const frontNotes = makeNotes('construction__notes construction__notes--front', FRONT_NOTES);
    const pull = makeElement(
      'p',
      'construction__pull type-pull',
      'The back is also a face.',
    );
    const macro = makeAssetImage(
      '/assets/construction/reverse-macro.webp',
      'Macro view of knots and carried thread on the reverse',
      'construction__macro drift-plate',
    );
    const body = makeElement('div', 'construction__body');
    const bodyParagraph = makeElement(
      'p',
      'construction__body-paragraph type-body',
      CONSTRUCTION_DEMO_CONTENT.detail,
    );
    bodyParagraph.dataset.contentStatus = 'temporary-demo';
    body.append(bodyParagraph);
    stage.append(header, cloth, frontNotes, pull, macro, body);
    el.append(stage);
  },
  timeline(tl, el, ctx) {
    const cloth = el.querySelector<HTMLElement>('.construction__cloth');
    const clothOverlay = el.querySelector<HTMLElement>('.construction__cloth-overlay');
    const plane = el.querySelector<HTMLElement>('.construction__plane');
    const frontNotes = el.querySelector<HTMLElement>('.construction__notes--front');
    const frontNoteEls = el.querySelectorAll<HTMLElement>(
      '.construction__notes--front .construction__note',
    );
    const pull = el.querySelector<HTMLElement>('.construction__pull');
    const macro = el.querySelector<HTMLElement>('.construction__macro');
    const header = el.querySelector<HTMLElement>('.construction__header');
    const heading = el.querySelector<HTMLElement>('.construction__heading');
    const bodySlot = el.querySelector<HTMLElement>('.construction__body');
    const bodyParagraphs = el.querySelectorAll<HTMLElement>(
      '.construction__body-paragraph',
    );

    if (heading) {
      addTextReveal(tl, heading, { position: 0, duration: 0.1 });
    }

    if (header) {
      tl.to(header, { opacity: 0, duration: 0.03, ease: 'none' }, 0.35);
    }

    if (cloth) {
      tl.fromTo(
        cloth,
        { opacity: 0.55, y: 36, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.15, ease: 'none' },
        0,
      );
    }

    if (frontNotes) {
      tl.set(frontNotes, { opacity: 1 }, 0.14);

      // Each of the four annotations gets its own beat: reveal with its
      // leader drawing in, hold at full emphasis, then settle to a quiet
      // 0.32 "still relevant" state before the next becomes primary. No
      // two labels are ever both at full emphasis at once.
      const beats: Array<[number, number]> = [
        [0.14, 0.2],
        [0.19, 0.25],
        [0.24, 0.3],
        [0.29, 0.35],
      ];

      frontNoteEls.forEach((note, index) => {
        const leader = note.querySelector<HTMLElement>(
          '.construction__note-leader',
        );
        const [activeAt, settleAt] = beats[index] ?? [0.14, 0.2];

        tl.fromTo(
          note,
          { opacity: 0 },
          { opacity: 1, duration: 0.02, ease: 'none' },
          activeAt,
        );

        if (leader) {
          tl.fromTo(
            leader,
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: 0.04,
              transformOrigin:
                index % 2 === 0 ? 'left center' : 'right center',
              ease: 'none',
            },
            activeAt,
          );
        }

        tl.to(note, { opacity: 0.32, duration: 0.02, ease: 'none' }, settleAt);
      });

      tl.to(frontNotes, { opacity: 0, duration: 0.02, ease: 'none' }, 0.36);
    }

    if (plane) {
      tl.to(
        plane,
        { rotationX: 180, duration: 0.27, ease: 'none' },
        0.38,
      );
    }

    if (pull) {
      addTextReveal(tl, pull, { position: 0.65, duration: 0.1 });
      tl.to(pull, { opacity: 0, duration: 0.08, ease: 'none' }, 0.77);
    }

    if (cloth && !ctx.reducedMotion) {
      tl.to(
        cloth,
        {
          scale: 1.35,
          xPercent: () => (window.innerWidth < 1200 ? 10 : -30),
          y: -8,
          duration: 0.2,
          ease: 'none',
        },
        0.8,
      );
    }

    // Same 0.8-1.0 handoff window the cloth-recede/macro-entrance tweens
    // already use: as macro slides in from the right, cloth (and its
    // darkening overlay) fade in two linear steps -- a subtle start
    // through 0.84, then the main move down to its quiet state by 0.94 --
    // so the outgoing image reads as clearly subordinate without an
    // abrupt jump, while macro (still ramping 0 -> 1 over the same
    // window, unchanged) overtakes it in brightness well before the
    // handoff completes. The quiet state keeps cloth above half its
    // original strength -- darkened and subordinate, not faded out.
    if (cloth) {
      tl.to(cloth, { opacity: 0.94, duration: 0.04, ease: 'none' }, 0.8);
      tl.to(cloth, { opacity: 0.72, duration: 0.1, ease: 'none' }, 0.84);
    }

    if (clothOverlay) {
      tl.to(clothOverlay, { opacity: 0.05, duration: 0.04, ease: 'none' }, 0.8);
      tl.to(clothOverlay, { opacity: 0.3, duration: 0.1, ease: 'none' }, 0.84);
    }

    if (macro) {
      if (ctx.reducedMotion) {
        tl.fromTo(
          macro,
          { opacity: 0, xPercent: 0, y: -8 },
          { opacity: 1, xPercent: 0, y: -8, duration: 0.2, ease: 'none' },
          0.8,
        );
      } else {
        tl.fromTo(
          macro,
          { opacity: 0, xPercent: 100, y: 10 },
          { opacity: 1, xPercent: 0, y: -8, duration: 0.2, ease: 'none' },
          0.8,
        );
      }
    }

    if (bodySlot && bodyParagraphs.length > 0) {
      tl.to(bodySlot, { opacity: 1, duration: 0.08, ease: 'none' }, 0.64);
    }

    scrubPlateDrift(tl, el, ctx.reducedMotion);
    finishTimeline(tl, el);
  },
};
