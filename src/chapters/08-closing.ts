import {
  STITCH_BANDS,
  STITCH_REPEATS_PER_BAND,
  STITCH_TOTAL,
  STITCH_UNITS_PER_REPEAT,
} from '../constants';
import {
  finishTimeline,
  makeAssetImage,
  makeElement,
  makeSequenceCanvas,
  scrubSequence,
} from '../lib/chapter-utils';
import { CLOSING_DEMO_CONTENT } from '../content/temporary-demo';
import { addTextReveal } from '../lib/text-reveal';
import type { Chapter } from '../lib/types';

export const closing: Chapter = {
  id: 'closing',
  label: 'Closing',
  scrollVh: 160,
  pinned: true,
  bg: 'var(--ink)',
  stitches: 658,
  preload: ['closing'],
  mount(el) {
    el.classList.add('closing');
    const ground = makeElement('div', 'closing__red-ground');
    ground.append(
      makeAssetImage(
        '/assets/textures/texture-red.webp',
        '',
        'closing__red-ground-texture',
      ),
    );
    const canvas = makeSequenceCanvas(
      'A single scarlet strand returning into darkness',
    );
    canvas.classList.add('closing__canvas');
    const thesis = makeElement('div', 'closing__thesis type-thesis');
    CLOSING_DEMO_CONTENT.thesis.forEach((line, index) => {
      thesis.append(
        makeElement(
          'p',
          `closing__thesis-line closing__thesis-line--${index + 1}`,
          line,
        ),
      );
    });
    thesis.dataset.contentStatus = 'temporary-demo';

    const credits = makeElement('footer', 'closing__credits');
    const makeCreditGroup = (
      title: string,
      lines: readonly string[],
      status?: string,
      extraClassName?: string,
    ) => {
      const group = makeElement(
        'section',
        `closing__credit-group type-annotation${extraClassName ? ` ${extraClassName}` : ''}`,
      );
      group.append(makeElement('h3', 'type-label', title));
      lines.forEach((line) => group.append(makeElement('p', '', line)));

      if (status) {
        group.dataset.contentStatus = status;
      }

      return group;
    };

    credits.append(
      makeCreditGroup('MOTIF SOURCE', [
        'The six animated traces were derived from AI-generated motif plates made using documentary photographs of real Toda embroidery as visual references. They are exhibition reconstructions, not scholarly motif diagrams.',
      ]),
      makeCreditGroup('STITCH ARITHMETIC', [
        `${STITCH_UNITS_PER_REPEAT} traced units × ${STITCH_REPEATS_PER_BAND} repeats × ${STITCH_BANDS} bands = ${STITCH_TOTAL.toLocaleString('en-IN')}.`,
        'This is the exhibition’s counting model, not a measured or universal total for a poothkuli.',
        CLOSING_DEMO_CONTENT.stitchModel,
      ]),
      makeCreditGroup(
        'METHOD',
        [
          "Built as a scroll-scrubbed exhibition. Every narrative movement is driven by scroll and fully reversible. The only timed elements are the film-grain flicker and the thread navigation's eight-second idle pulse.",
          CLOSING_DEMO_CONTENT.idlePulse,
        ],
        'temporary-demo',
      ),
      makeCreditGroup('PRIMARY DATA', [CLOSING_DEMO_CONTENT.researchBasis]),
      makeCreditGroup('IMAGERY', [
        'The photographs of the real cloth used as reference for this project are documentary. All imagery presented on this site is AI-generated, produced using those photographs as visual reference. No image here is a photograph of a real putukuli, a real artisan, or a real place.',
        'This disclosure is part of the argument. A site about hidden authorship should declare its own.',
      ]),
      makeCreditGroup('TYPE', [
        'Fraunces, Space Grotesk, IBM Plex Mono.',
      ]),
      makeCreditGroup('COLOUR', [
        'Scarlet — #C4122F — primary accent',
        'Cloth — #E4DAC6 — textile ground and primary light text',
        'Cloth lit — #F0E8D8 — highlighted light text',
        'Ink — #0B0B0C — deep background',
        'Black — #151313 — secondary dark',
        'Slate — #5A6570 — secondary and inactive state',
      ]),
      makeCreditGroup('DESIGN METHOD', [
        'Typography — Fraunces display text with Space Grotesk and IBM Plex Mono support text.',
        'Grid — a 22px counted-cell interaction grid.',
        'Image treatment — full-viewport sequence canvases and fixed-aspect image crops.',
        'Motion — scroll-scrubbed and reversible chapter timelines.',
        'Interaction states — visible hover, focus, selected and inactive states.',
      ]),
      makeCreditGroup(
        'SOURCES',
        [
          'Geographical Indications Registry, Intellectual Property India — “Toda Embroidery,” Application 135.',
          'Development Commissioner (Handicrafts), Ministry of Textiles, Government of India — “Toda Embroidery” and the geographical-indications craft compendium.',
          'People’s Archive of Rural India — “‘Copying our designs is not correct.’”',
          'Asia InCH / Global InCH — “Toda Tribal Embroidery of Nilgiri, Tamil Nadu.”',
          'Garima Sharma and Simmi Bhagat — “Revival of Toda Embroidery: Needlecraft of Nilgiris.”',
          'PLOS ONE — “Topographic and Bioclimatic Determinants of the Occurrence of Forest and Grassland in Tropical Montane Forest–Grassland Mosaics of the Western Ghats, India.”',
        ],
        undefined,
        'closing__credit-group--column-start',
      ),
      makeCreditGroup('TRANSLITERATION & REVIEW', [
        'Transliteration varies across published sources. Poothkuli also appears as putukuli and pootkhull(zh)y; pukhoor also appears as pugur.',
        'Sources reviewed July 2026.',
      ]),
    );
    el.append(ground, canvas, thesis, credits);
  },
  timeline(tl, el, ctx) {
    const canvas = el.querySelector<HTMLCanvasElement>('.closing__canvas');
    const ground = el.querySelector<HTMLElement>('.closing__red-ground');
    const thesis = el.querySelector<HTMLElement>('.closing__thesis');
    const thesisLines = el.querySelectorAll<HTMLElement>(
      '.closing__thesis-line',
    );
    const credits = el.querySelector<HTMLElement>('.closing__credits');

    if (canvas) {
      scrubSequence(tl, canvas, 'closing', 72, 0, 0.5, ctx.reducedMotion, 72);
      tl.to(canvas, { opacity: 0.36, duration: 0.5, ease: 'none' }, 0.5);
    }

    if (thesis) {
      tl.set(thesis, { opacity: 1 }, 0.5);
      addTextReveal(tl, [...thesisLines], {
        position: 0.5,
        duration: 0.12,
      });
      tl.to(
        thesis,
        { y: -90, opacity: 0, duration: 0.2, ease: 'none' },
        0.8,
      );
    }

    if (ground) {
      tl.to(ground, { opacity: 1, duration: 0.2, ease: 'none' }, 0.8);
    }

    if (credits) {
      tl.fromTo(
        credits,
        { yPercent: 100, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.2, ease: 'none' },
        0.8,
      );
    }

    finishTimeline(tl, el);
  },
};
