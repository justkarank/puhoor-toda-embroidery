import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { chapters } from './chapters';
import {
  BACKGROUND_BLEED_VH,
  LIGHT_GROUNDS,
  STITCH_TOTAL,
} from './constants';
import { mountGrain } from './lib/grain';
import { mountLattice } from './lib/lattice';
import { runPreloaderGate } from './lib/preloader';
import { loadSequence, preloadSequences } from './lib/sequence';
import { mountThreadNav } from './lib/thread-nav';
import type {
  Chapter,
  ChapterContext,
  ChapterMetrics,
} from './lib/types';
import './styles/tokens.css';
import './styles/type.css';
import './styles/base.css';

const mobileQuery = window.matchMedia('(max-width: 899px)');
export let lenis: Lenis | null = null;

mobileQuery.addEventListener('change', () => {
  window.location.reload();
});

function mountMobileFallback(): void {
  const root = document.querySelector<HTMLElement>('#exhibition');

  if (!root) {
    return;
  }

  root.className = 'mobile-fallback';
  root.setAttribute('aria-label', 'Toda Embroidery desktop notice');
  root.replaceChildren();

  const image = new Image();
  image.className = 'mobile-fallback__image';
  image.src = '/assets/hero/0001.webp';
  image.alt = '';

  const overlay = document.createElement('div');
  overlay.className = 'mobile-fallback__overlay';

  const title = document.createElement('h1');
  title.className = 'mobile-fallback__title';
  title.setAttribute('aria-label', 'Toda Embroidery — Puhoor');
  const descriptor = document.createElement('span');
  descriptor.className =
    'mobile-fallback__title-line mobile-fallback__title-line--descriptor';
  descriptor.setAttribute('aria-hidden', 'true');
  descriptor.textContent = 'TODA EMBROIDERY';
  const puhoor = document.createElement('span');
  puhoor.className =
    'mobile-fallback__title-line mobile-fallback__title-line--puhoor';
  puhoor.setAttribute('aria-hidden', 'true');
  puhoor.textContent = 'Puhoor';
  title.append(descriptor, puhoor);

  const message = document.createElement('p');
  message.className = 'mobile-fallback__message';
  message.textContent = 'This exhibition is built for a desktop screen.';

  root.append(image, overlay, title, message);
}

function deriveMetrics(registry: Chapter[]): ChapterMetrics[] {
  let scrollCursor = 0;
  let stitchCursor = 0;
  let stitchWeightCursor = 0;
  const stitchWeightTotal = registry.reduce(
    (total, chapter) => total + chapter.stitches,
    0,
  );

  return registry.map((chapter, index) => {
    stitchWeightCursor += chapter.stitches;
    const stitchEnd =
      index === registry.length - 1
        ? STITCH_TOTAL
        : Math.round(
            (stitchWeightCursor / stitchWeightTotal) * STITCH_TOTAL,
          );
    const metrics: ChapterMetrics = {
      chapter,
      index,
      scrollStartVh: scrollCursor,
      scrollEndVh: scrollCursor + chapter.scrollVh,
      stitchStart: stitchCursor,
      stitchEnd,
    };
    scrollCursor = metrics.scrollEndVh;
    stitchCursor = metrics.stitchEnd;
    return metrics;
  });
}

function mountChapterShell(
  chapter: Chapter,
  index: number,
): { section: HTMLElement; surface: HTMLElement } {
  const section = document.createElement('section');
  section.id = `chapter-${chapter.id}`;
  section.className = 'chapter';
  section.dataset.chapter = chapter.id;
  section.dataset.chapterIndex = String(index);
  section.dataset.bg = chapter.bg;
  section.style.setProperty('--chapter-scroll-vh', String(chapter.scrollVh));
  section.setAttribute('aria-label', chapter.label);

  const surface = document.createElement('div');
  surface.className = 'chapter__surface';
  surface.dataset.bg = chapter.bg;
  section.append(surface);

  return { section, surface };
}

function mountBackgroundBleed(
  metrics: ChapterMetrics[],
  totalScrollVh: number,
): void {
  const body = document.body;
  const timeline = gsap.timeline({ paused: true });
  const scrollableVh = Math.max(1, totalScrollVh - 100);
  const resolveColor = (value: string): string => {
    const token = value.match(/^var\((--[^)]+)\)$/)?.[1];
    return token
      ? getComputedStyle(document.documentElement).getPropertyValue(token).trim()
      : value;
  };
  const threadTone = (
    ground: string,
  ): { color: string; opacity: number; shadowOpacity: number } => {
    const relativeLuminance = (value: string): number => {
      const match = value.match(
        /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i,
      );
      const rgb = match
        ? [
            Number.parseInt(match[1], 16),
            Number.parseInt(match[2], 16),
            Number.parseInt(match[3], 16),
          ]
        : [0, 0, 0];
      const linear = rgb.map((channel) => {
        const value = channel / 255;
        return value <= 0.03928
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      });

      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };
    const contrastRatio = (first: number, second: number): number =>
      (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
    const groundLuminance = relativeLuminance(resolveColor(ground));
    const cloth = resolveColor('var(--cloth)');
    const black = resolveColor('var(--black)');
    const clothContrast = contrastRatio(
      groundLuminance,
      relativeLuminance(cloth),
    );
    const blackContrast = contrastRatio(
      groundLuminance,
      relativeLuminance(black),
    );
    const useCloth = clothContrast >= blackContrast;

    return {
      color: useCloth ? cloth : black,
      opacity: 0.8,
      shadowOpacity: useCloth ? 0.15 : 0,
    };
  };
  const initialGround = metrics[0]?.chapter.bg ?? 'var(--ink)';
  const initialTone = threadTone(initialGround);

  timeline.set(
    body,
    {
      backgroundColor: resolveColor(initialGround),
      '--thread-label-color': initialTone.color,
      '--thread-label-opacity': initialTone.opacity,
      '--thread-shadow-opacity': initialTone.shadowOpacity,
    },
    0,
  );

  // Single navigation-surface tone: --thread-nav-surface-rgb and
  // --thread-nav-label-rgb are interpolated together as one paired unit
  // (dark ground -> dark surface + light label, light ground -> the
  // reverse), driven by this same object so a GSAP tween can animate
  // the plain RGB channels directly rather than crossfading two
  // separate scrim elements.
  const NAV_TONE = {
    dark: { surface: [11, 11, 12], label: [240, 232, 216] },
    light: { surface: [228, 218, 198], label: [21, 19, 19] },
  } as const;
  const navToneFor = (ground: string) =>
    LIGHT_GROUNDS.has(ground) ? NAV_TONE.light : NAV_TONE.dark;
  // Surface opacity is Hero-only: 0.88 through Hero, faded out during
  // Hero's own exit, then permanently 0 from About onward (no
  // background band anywhere else — only the label fill/stroke RGB
  // continue to track each chapter's ground tone after that).
  const navState = { r: 0, g: 0, b: 0, lr: 0, lg: 0, lb: 0, opacity: 0.88 };
  const applyNavTone = () => {
    body.style.setProperty(
      '--thread-nav-surface-rgb',
      `${navState.r.toFixed(1)} ${navState.g.toFixed(1)} ${navState.b.toFixed(1)}`,
    );
    body.style.setProperty(
      '--thread-nav-label-rgb',
      `${navState.lr.toFixed(1)} ${navState.lg.toFixed(1)} ${navState.lb.toFixed(1)}`,
    );
    body.style.setProperty(
      '--thread-nav-surface-opacity',
      navState.opacity.toFixed(3),
    );
  };
  const initialNavTone = navToneFor(initialGround);

  // Applied synchronously, before any GSAP/ScrollTrigger render pass —
  // a GSAP .set() on a paused timeline does not reliably fire its own
  // onUpdate callback on the very first render, which previously left
  // the CSS custom properties at navState's raw JS-literal zero values
  // (black label, black stroke) until the first scroll-driven update.
  navState.r = initialNavTone.surface[0];
  navState.g = initialNavTone.surface[1];
  navState.b = initialNavTone.surface[2];
  navState.lr = initialNavTone.label[0];
  navState.lg = initialNavTone.label[1];
  navState.lb = initialNavTone.label[2];
  navState.opacity = 0.88;
  applyNavTone();

  timeline.set(
    navState,
    {
      r: navState.r,
      g: navState.g,
      b: navState.b,
      lr: navState.lr,
      lg: navState.lg,
      lb: navState.lb,
      opacity: navState.opacity,
      onUpdate: applyNavTone,
    },
    0,
  );

  // Hero-only surface fade: hero.scrollVh(220) - 100 = 120 "vh" units of
  // this timeline's own scale (which corresponds 1:1 to real scroll-vh,
  // confirmed in the earlier nav-transition work) make up Hero's own
  // local progress range, so Hero-local progress 0.86/0.94/1.00 map to
  // 103.2/112.8/120 here.
  const heroMetric = metrics[0];

  if (heroMetric) {
    const heroLocalRangeVh = heroMetric.chapter.scrollVh - 100;

    timeline.to(
      navState,
      {
        opacity: 0.36,
        duration: (0.94 - 0.86) * heroLocalRangeVh,
        ease: 'none',
        onUpdate: applyNavTone,
      },
      0.86 * heroLocalRangeVh,
    );
    timeline.to(
      navState,
      {
        opacity: 0,
        duration: (1 - 0.94) * heroLocalRangeVh,
        ease: 'none',
        onUpdate: applyNavTone,
      },
      0.94 * heroLocalRangeVh,
    );
  }

  // For a pinned chapter using the standard 'top top'/'bottom bottom'
  // trigger, its pin releases one full viewport-height of scroll *before*
  // its own document height ends (main.ts's own ScrollTrigger end
  // condition) — chapters using a releaseTailVh instead release that
  // many vh earlier still. After release, the chapter's own surface
  // scrolls away normally for that remaining stretch (a "tail"), which
  // can bring its own content up past the nav before the boundary-timed
  // bleed window (anchored to the document-height end) would otherwise
  // switch the label. Used below so the nav label always switches no
  // later than the moment the outgoing chapter's content actually starts
  // moving, not merely when its document height is exhausted.
  const pinReleaseVh = (metric: ChapterMetrics): number => {
    if (!metric.chapter.pinned) {
      return metric.scrollEndVh;
    }

    const releaseTailVh = metric.chapter.releaseTailVh ?? 0;

    return releaseTailVh > 0
      ? metric.scrollEndVh - releaseTailVh
      : metric.scrollEndVh - 100;
  };

  metrics.slice(0, -1).forEach((metric, index) => {
    const { chapter, scrollEndVh } = metric;
    const next = metrics[index + 1].chapter;
    const bleedVh =
      chapter.id === 'grid' && next.id === 'nilgiris'
        ? 100
        : BACKGROUND_BLEED_VH;
    const start = Math.max(0, scrollEndVh - bleedVh);
    const nextTone = threadTone(next.bg);
    timeline.to(
      body,
      {
        backgroundColor: resolveColor(next.bg),
        '--thread-label-color': nextTone.color,
        '--thread-label-opacity': nextTone.opacity,
        '--thread-shadow-opacity': nextTone.shadowOpacity,
        duration: bleedVh,
        ease: 'none',
        onStart: () => {
          body.classList.toggle('is-light-ground', LIGHT_GROUNDS.has(next.bg));
        },
        onReverseComplete: () => {
          body.classList.toggle(
            'is-light-ground',
            LIGHT_GROUNDS.has(chapter.bg),
          );
        },
      },
      start,
    );

    // Only the two pairs that actually cross a light/dark boundary need
    // a nav-tone transition (Construction -> Motifs, Grid -> Nilgiris).
    const outgoingIsLight = LIGHT_GROUNDS.has(chapter.bg);
    const incomingIsLight = LIGHT_GROUNDS.has(next.bg);

    if (outgoingIsLight !== incomingIsLight) {
      const navTarget = navToneFor(next.bg);

      // A smooth crossfade here (matching the body background's own
      // duration) was the wrong shape for this pair specifically: label
      // fill and its opposite-tone stroke are interpolating toward each
      // other's starting values at the same rate, so they pass through
      // near-identical RGB right around the window's midpoint — measured
      // directly as fill rgb(143 137 128) vs stroke rgb(107 103 95), a
      // ~35-unit gap that reads as a washed-out, muddy label with
      // essentially no protective contrast. A label only ever needs to
      // read against the *current* background, so there is no benefit to
      // a gradual blend the way the body colour bleed has (fill/stroke
      // are never partway "between" two chapters simultaneously) — a
      // near-instant switch keeps both always at their crisp, fully
      // opposite-tone values. Uses a very short .to() rather than a true
      // zero-duration .set() so onUpdate keeps firing reliably on every
      // scrubbed render, forward and reverse.
      //
      // Positioned at the outgoing chapter's own pin-release point
      // (rather than the document-height-anchored bleed window used for
      // the body background above) — for a pinned outgoing chapter like
      // Construction, its content stays fixed on screen until release,
      // then scrolls away normally for a full extra viewport-height
      // ("tail") before the next chapter's document begins. That tail
      // can bring the outgoing chapter's own content up past the nav;
      // switching only once its document height is exhausted (the old
      // approach) left the label in the wrong tone for that entire
      // tail — measured directly on Construction's own cream swatch
      // scrolling past the nav while the label was still dark-ground.
      const switchPoint = Math.min(pinReleaseVh(metric), scrollEndVh);

      timeline.to(
        navState,
        {
          r: navTarget.surface[0],
          g: navTarget.surface[1],
          b: navTarget.surface[2],
          lr: navTarget.label[0],
          lg: navTarget.label[1],
          lb: navTarget.label[2],
          duration: Math.min(0.5, bleedVh * 0.02),
          ease: 'none',
          onUpdate: applyNavTone,
        },
        switchPoint,
      );
    }
  });

  timeline.set(body, {}, scrollableVh);

  ScrollTrigger.create({
    animation: timeline,
    start: 0,
    end: () => ScrollTrigger.maxScroll(window),
    scrub: true,
    invalidateOnRefresh: true,
  });
}

async function bootDesktop(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#exhibition');

  if (!root) {
    throw new Error('Missing #exhibition root element.');
  }

  gsap.registerPlugin(ScrollTrigger);

  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  const desktopLenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
  });
  lenis = desktopLenis;

  desktopLenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => {
    desktopLenis.raf(time * 1_000);
  });
  gsap.ticker.lagSmoothing(0);

  const metrics = deriveMetrics(chapters);
  const stitchTotal = metrics.at(-1)?.stitchEnd ?? STITCH_TOTAL;
  const totalScrollVh = metrics.at(-1)?.scrollEndVh ?? 0;
  const ctx: ChapterContext = {
    lenis: desktopLenis,
    stitchTotal,
    reducedMotion,
    metrics,
    loadSequence,
  };

  document.documentElement.style.setProperty(
    '--total-scroll-vh',
    String(totalScrollVh),
  );
  root.dataset.chapterCount = String(chapters.length);
  root.dataset.totalScrollVh = String(totalScrollVh);
  root.dataset.stitchTotal = String(stitchTotal);

  mountLattice();
  mountGrain(reducedMotion);

  const preloadTwoChaptersAhead = (index: number) => {
    if (reducedMotion) {
      return;
    }

    const preload = chapters[index + 2]?.preload;

    if (preload?.length) {
      preloadSequences(preload);
    }
  };

  for (const { chapter, index } of metrics) {
    const { section, surface } = mountChapterShell(chapter, index);
    const releaseTailVh = chapter.releaseTailVh ?? 0;
    root.append(section);
    await chapter.mount(surface, ctx);

    const timeline = gsap.timeline();
    chapter.timeline(timeline, surface, ctx);

    ScrollTrigger.create({
      animation: timeline,
      trigger: section,
      start: 'top top',
      end:
        chapter.pinned && releaseTailVh > 0
          ? () =>
              `+=${((chapter.scrollVh - releaseTailVh) * window.innerHeight) / 100}`
          : 'bottom bottom',
      pin: chapter.pinned ? surface : false,
      pinSpacing: false,
      scrub: chapter.pinned ? 1 : 0.6,
      invalidateOnRefresh: true,
      onEnter: () => preloadTwoChaptersAhead(index),
      onEnterBack: () => preloadTwoChaptersAhead(index),
    });
  }

  preloadTwoChaptersAhead(0);

  mountBackgroundBleed(metrics, totalScrollVh);
  mountThreadNav(metrics, ctx);

  desktopLenis.stop();
  await runPreloaderGate(ctx);
  desktopLenis.start();
  ScrollTrigger.refresh();
}

if (mobileQuery.matches) {
  mountMobileFallback();
} else {
  void bootDesktop();
}
