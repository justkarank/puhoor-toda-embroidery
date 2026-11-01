import {
  finishTimeline,
  makeElement,
  makeSequenceCanvas,
  scrubSequence,
} from '../lib/chapter-utils';
import gsap from 'gsap';
import { HERO_DEMO_CONTENT } from '../content/temporary-demo';
import { addTextReveal } from '../lib/text-reveal';
import type { Chapter } from '../lib/types';

export const hero: Chapter = {
  id: 'hero',
  label: 'Hero',
  scrollVh: 220,
  pinned: true,
  bg: 'var(--ink)',
  stitches: 1_222,
  preload: ['hero'],
  mount(el) {
    el.classList.add('hero');
    const canvas = makeSequenceCanvas(
      'A pull-back from individual cotton fibres to an embroidered cloth',
    );
    canvas.classList.add('hero__canvas');
    const protection = makeElement('div', 'hero__protection');
    protection.setAttribute('aria-hidden', 'true');

    const titleWrap = makeElement('div', 'hero__title-wrap');
    const title = makeElement('h1', 'hero__title');
    title.setAttribute('aria-label', 'Toda Embroidery — Puhoor');

    const makeTitleLine = (className: string, text: string) => {
      const line = makeElement('span', `hero__title-line ${className}`);
      line.setAttribute('aria-hidden', 'true');
      const inner = makeElement('span', 'hero__title-line-inner', text);
      line.append(inner);
      return { line, inner };
    };

    const descriptor = makeTitleLine(
      'hero__title-line--descriptor',
      'TODA EMBROIDERY',
    );
    const puhoor = makeTitleLine('hero__title-line--puhoor', 'Puhoor');
    title.append(descriptor.line, puhoor.line);

    const guide = makeElement('span', 'hero__title-guide');
    guide.setAttribute('aria-hidden', 'true');
    guide.append(
      makeElement('span', 'hero__title-guide-line'),
      makeElement('span', 'hero__title-guide-knot'),
    );
    titleWrap.append(title, guide);

    const correction = makeElement(
      'p',
      'hero__correction type-annotation',
      HERO_DEMO_CONTENT.correction,
    );
    correction.dataset.contentStatus = 'temporary-demo';
    const threshold = makeElement('div', 'hero__threshold');
    threshold.setAttribute('aria-hidden', 'true');
    const cue = makeElement('div', 'hero__scroll-cue');
    const cueLabel = makeElement(
      'span',
      'hero__scroll-label',
      'Scroll to explore',
    );
    const cueTrack = makeElement('span', 'hero__scroll-track');
    cueTrack.setAttribute('aria-hidden', 'true');
    cueTrack.append(makeElement('span', 'hero__scroll-indicator'));
    cue.append(cueLabel, cueTrack);
    el.append(canvas, protection, threshold, titleWrap, correction, cue);
  },
  timeline(tl, el, ctx) {
    const canvas = el.querySelector<HTMLCanvasElement>('.hero__canvas');
    const protection = el.querySelector<HTMLElement>('.hero__protection');
    const titleWrap = el.querySelector<HTMLElement>('.hero__title-wrap');
    const descriptor = el.querySelector<HTMLElement>(
      '.hero__title-line--descriptor .hero__title-line-inner',
    );
    const puhoor = el.querySelector<HTMLElement>(
      '.hero__title-line--puhoor .hero__title-line-inner',
    );
    const guide = el.querySelector<HTMLElement>('.hero__title-guide');
    const guideLine = el.querySelector<HTMLElement>('.hero__title-guide-line');
    const guideKnot = el.querySelector<HTMLElement>('.hero__title-guide-knot');
    const correction = el.querySelector<HTMLElement>('.hero__correction');
    const threshold = el.querySelector<HTMLElement>('.hero__threshold');
    const cue = el.querySelector<HTMLElement>('.hero__scroll-cue');
    const cueLabel = el.querySelector<HTMLElement>('.hero__scroll-label');
    const cueIndicator = el.querySelector<HTMLElement>(
      '.hero__scroll-indicator',
    );

    if (canvas) {
      scrubSequence(tl, canvas, 'hero', 96, 0, 0.9, ctx.reducedMotion, 1);
    }

    if (!ctx.reducedMotion) {
      if (cue) {
        tl.fromTo(
          cue,
          { opacity: 1 },
          { opacity: 0.45, duration: 0.06, ease: 'none' },
          0,
        );
        tl.to(cue, { opacity: 0, duration: 0.06, ease: 'none' }, 0.06);
      }

      if (cueLabel && cueIndicator) {
        let cueLoop: gsap.core.Timeline | null = null;
        let hasLeftStart = false;
        let isCleanedUp = false;

        const stopCueLoop = () => {
          cueLoop?.kill();
          cueLoop = null;
          gsap.set(cueLabel, { opacity: 1 });
          gsap.set(cueIndicator, { y: 0, opacity: 0 });
        };

        const startCueLoop = () => {
          if (cueLoop || isCleanedUp || window.scrollY > 0.5) {
            return;
          }

          gsap.set(cueLabel, { opacity: 0.72 });
          gsap.set(cueIndicator, { y: 0, opacity: 0 });
          cueLoop = gsap.timeline({ repeat: -1, repeatDelay: 0.7 });
          cueLoop
            .to(
              cueIndicator,
              {
                y: 8,
                opacity: 1,
                duration: 0.28,
                ease: 'power1.inOut',
              },
              0,
            )
            .to(cueIndicator, {
              y: 32,
              opacity: 1,
              duration: 0.84,
              ease: 'power1.inOut',
            })
            .to(cueIndicator, {
              y: 40,
              opacity: 0,
              duration: 0.28,
              ease: 'power1.inOut',
            })
            .to(
              cueLabel,
              {
                opacity: 1,
                duration: 0.7,
                ease: 'power1.inOut',
                repeat: 1,
                yoyo: true,
              },
              0,
            );
        };

        const updateCueLoop = () => {
          const chapter = el.closest<HTMLElement>('.chapter');
          const scrollRange = chapter
            ? Math.max(1, chapter.offsetHeight - window.innerHeight)
            : 1;
          const progress = chapter
            ? Math.max(0, -chapter.getBoundingClientRect().top) / scrollRange
            : 0;

          if (progress > 0.04) {
            hasLeftStart = true;
            stopCueLoop();
            return;
          }

          if (progress <= 0.0001 && (hasLeftStart || !cueLoop)) {
            hasLeftStart = false;
            startCueLoop();
          }
        };

        const removalObserver = new MutationObserver(() => {
          if (!el.isConnected) {
            cleanupCueLoop();
          }
        });
        const cleanupCueLoop = () => {
          if (isCleanedUp) {
            return;
          }

          isCleanedUp = true;
          stopCueLoop();
          removalObserver.disconnect();
          window.removeEventListener('scroll', updateCueLoop);
          window.removeEventListener('pagehide', cleanupCueLoop);
        };

        removalObserver.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('scroll', updateCueLoop, { passive: true });
        window.addEventListener('pagehide', cleanupCueLoop, { once: true });
        startCueLoop();
      }

      if (titleWrap) {
        tl.fromTo(
          titleWrap,
          { y: 6, scale: 0.995 },
          { y: 0, scale: 1, duration: 0.08, ease: 'none' },
          0,
        );
        tl.to(
          titleWrap,
          { y: -12, scale: 0.985, duration: 0.33, ease: 'none' },
          0.22,
        );
      }

      if (protection) {
        tl.fromTo(
          protection,
          { opacity: 1 },
          { opacity: 0.88, duration: 0.55, ease: 'none' },
          0,
        );
        tl.to(protection, { opacity: 0, duration: 0.45, ease: 'none' }, 0.55);
      }

      if (descriptor) {
        tl.fromTo(
          descriptor,
          { letterSpacing: '0.16em' },
          { letterSpacing: '0.18em', duration: 0.14, ease: 'none' },
          0.08,
        );
        // 0.48-0.56: TODA EMBROIDERY masks out first.
        tl.to(descriptor, { yPercent: -112, duration: 0.08, ease: 'none' }, 0.48);
      }

      if (puhoor) {
        // 0.56-0.72: Puhoor masks out on its own over the full window
        // previously shared by the two-line thesis/correction pairing,
        // so the single title word still reads as a deliberate, unhurried
        // exit rather than an abrupt cut.
        tl.to(puhoor, { yPercent: -112, duration: 0.16, ease: 'none' }, 0.56);
      }

      if (guideLine) {
        tl.fromTo(
          guideLine,
          { clipPath: 'inset(0 100% 0 0)' },
          { clipPath: 'inset(0 0% 0 0)', duration: 0.08, ease: 'none' },
          0,
        );
        tl.to(
          guideLine,
          { clipPath: 'inset(0 8% 0 0)', duration: 0.33, ease: 'none' },
          0.11,
        );
        // Contract the guide alongside the title masking out, 0.52-0.72.
        tl.to(
          guideLine,
          { clipPath: 'inset(0 0 0 100%)', duration: 0.2, ease: 'none' },
          0.52,
        );
      }

      if (guideKnot) {
        tl.fromTo(
          guideKnot,
          { scale: 0 },
          { scale: 1, duration: 0.08, ease: 'none' },
          0,
        );
      }

      if (guide) {
        tl.to(guide, { opacity: 0, duration: 0.06, ease: 'none' }, 0.66);
      }

      if (threshold) {
        tl.fromTo(
          threshold,
          { scaleY: 0 },
          { scaleY: 8 / 22, duration: 0.06, ease: 'none' },
          0.76,
        );
        tl.to(threshold, { scaleY: 1, duration: 0.18, ease: 'none' }, 0.82);
      }

      if (correction) {
        // Begins only once the main title has fully masked out at 0.72,
        // holds through 0.90, then clears before the 0.96 release.
        addTextReveal(tl, correction, {
          position: 0.72,
          duration: 0.1,
          stagger: 0,
          yPercent: 112,
        });
        // Restrained, editorial-caption strength rather than full
        // opacity: readable but clearly secondary to the title.
        tl.to(correction, { opacity: 0.88, duration: 0.001, ease: 'none' }, 0.72);
        tl.to(correction, { opacity: 0, duration: 0.06, ease: 'none' }, 0.9);
      }
    }

    finishTimeline(tl, el);
  },
};
