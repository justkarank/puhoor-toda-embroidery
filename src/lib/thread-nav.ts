import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { ChapterContext, ChapterMetrics } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const THREAD_Y = 32;
const THREAD_START_X = 60;
const EDGE_INSET = 40;
const TURN_RADIUS = 16;
const COUNTER_ARC_OFFSET = 80;
const CONTROL_POINT_SPACING = 40;
const PATH_DEVIATION = 0.4;
const IDLE_DELAY_MS = 8_000;
const HORIZONTAL_SEED = 0x544f4441;
const VERTICAL_SEED = 0x50554b48;

interface Point {
  x: number;
  y: number;
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  name: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, name);
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function format(value: number): string {
  return value.toFixed(2);
}

function createRunPoints(
  start: Point,
  end: Point,
  horizontal: boolean,
  seed: number,
): Point[] {
  const length = horizontal ? end.x - start.x : end.y - start.y;
  const segmentCount = Math.max(
    1,
    Math.ceil(Math.abs(length) / CONTROL_POINT_SPACING),
  );
  const random = createSeededRandom(seed);

  return Array.from({ length: segmentCount + 1 }, (_, index) => {
    const ratio = index / segmentCount;
    const isEndpoint = index === 0 || index === segmentCount;
    const deviation = isEndpoint
      ? 0
      : (random() * 2 - 1) * PATH_DEVIATION;

    return horizontal
      ? {
          x: start.x + (end.x - start.x) * ratio,
          y: start.y + deviation,
        }
      : {
          x: start.x + deviation,
          y: start.y + (end.y - start.y) * ratio,
        };
  });
}

function smoothRunCommands(points: Point[]): string {
  if (points.length < 2) {
    return '';
  }

  if (points.length === 2) {
    return `L ${format(points[1].x)} ${format(points[1].y)}`;
  }

  const commands: string[] = [];

  for (let index = 1; index < points.length - 1; index += 1) {
    const control = points[index];
    const next = points[index + 1];
    const midpoint = {
      x: (control.x + next.x) / 2,
      y: (control.y + next.y) / 2,
    };

    commands.push(
      `Q ${format(control.x)} ${format(control.y)} ${format(midpoint.x)} ${format(midpoint.y)}`,
    );
  }

  const penultimate = points.at(-2);
  const last = points.at(-1);

  if (penultimate && last) {
    commands.push(
      `Q ${format(penultimate.x)} ${format(penultimate.y)} ${format(last.x)} ${format(last.y)}`,
    );
  }

  return commands.join(' ');
}

export function mountThreadNav(
  metrics: ChapterMetrics[],
  ctx: ChapterContext,
): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'thread-nav';
  nav.setAttribute('aria-label', 'Exhibition chapters');

  // One shared atmospheric-protection surface. Its tone is driven by
  // --thread-nav-surface-rgb (interpolated alongside the background
  // bleed in main.ts), so there is never a second scrim to crossfade
  // against and never a muddy double-opacity band mid-transition.
  const scrim = document.createElement('div');
  scrim.className = 'thread-nav__scrim';
  scrim.setAttribute('aria-hidden', 'true');
  nav.append(scrim);

  const svg = createSvgElement('svg');
  svg.classList.add('thread-nav__svg');
  svg.setAttribute('focusable', 'false');

  // Deterministic top-to-bottom reveal for the scroll-progress path: one
  // clip rectangle whose height grows from 0 at its own fixed top (the
  // corner), revealing the already-fully-rendered path downward as it
  // grows. The path's own geometry (`d`, position, transform) is never
  // touched by scroll — only this rectangle's height changes — so there
  // is exactly one way the path can ever look: covered above the current
  // reveal height, or not. This replaces the previous stroke-dasharray /
  // stroke-dashoffset reveal, which depended on the path's own
  // getTotalLength() (only reliable once the SVG has stable layout) and
  // left room for the two paths' dash state to fall out of sync.
  const clipId = 'thread-progress-clip';
  const defs = createSvgElement('defs');
  const clipPathEl = createSvgElement('clipPath');
  clipPathEl.setAttribute('id', clipId);
  clipPathEl.setAttribute('clipPathUnits', 'userSpaceOnUse');
  const clipRect = createSvgElement('rect');
  clipRect.setAttribute('x', '0');
  clipRect.setAttribute('y', '0');
  clipRect.setAttribute('width', '0');
  clipRect.setAttribute('height', '0');
  clipPathEl.append(clipRect);
  defs.append(clipPathEl);
  svg.append(defs);

  const progressShadow = createSvgElement('path');
  progressShadow.classList.add(
    'thread-nav__path',
    'thread-nav__path--progress',
    'thread-nav__path--shadow',
  );
  progressShadow.setAttribute('fill', 'none');
  progressShadow.setAttribute('vector-effect', 'non-scaling-stroke');
  progressShadow.setAttribute('transform', 'translate(0.5 0.5)');
  progressShadow.setAttribute('clip-path', `url(#${clipId})`);

  const navbarPath = createSvgElement('path');
  navbarPath.classList.add(
    'thread-nav__path',
    'thread-nav__path--navbar',
    'thread-nav__path--main',
  );
  navbarPath.setAttribute('fill', 'none');
  navbarPath.setAttribute('vector-effect', 'non-scaling-stroke');

  const progressPath = createSvgElement('path');
  progressPath.classList.add(
    'thread-nav__path',
    'thread-nav__path--progress',
    'thread-nav__path--main',
  );
  progressPath.setAttribute('fill', 'none');
  progressPath.setAttribute('vector-effect', 'non-scaling-stroke');
  progressPath.setAttribute('clip-path', `url(#${clipId})`);

  svg.append(progressShadow, navbarPath, progressPath);

  const knots = metrics.map(({ chapter }) => {
    const group = createSvgElement('g');
    group.classList.add('thread-nav__knot');
    group.dataset.chapter = chapter.id;
    group.setAttribute('role', 'link');
    group.setAttribute('tabindex', '0');
    group.setAttribute('aria-label', `Go to ${chapter.label}`);

    const hitArea = createSvgElement('rect');
    hitArea.classList.add('thread-nav__knot-hit');
    hitArea.setAttribute('rx', '2');

    const geometry = createSvgElement('g');
    geometry.classList.add('thread-nav__knot-geometry');

    const loop = createSvgElement('ellipse');
    loop.classList.add('thread-nav__knot-loop');
    loop.setAttribute('cx', '0');
    loop.setAttribute('cy', '0');
    loop.setAttribute('rx', '6.5');
    loop.setAttribute('ry', '4.5');
    loop.setAttribute('fill', 'none');
    loop.setAttribute('vector-effect', 'non-scaling-stroke');

    const pass = createSvgElement('path');
    pass.classList.add('thread-nav__knot-pass');
    pass.setAttribute('d', 'M -7.5 0 C -3 -1.35 3 1.35 7.5 0');
    pass.setAttribute('fill', 'none');
    pass.setAttribute('vector-effect', 'non-scaling-stroke');

    const centre = createSvgElement('circle');
    centre.classList.add('thread-nav__knot-centre');
    centre.setAttribute('cx', '0');
    centre.setAttribute('cy', '0');
    centre.setAttribute('r', '1.5');

    const label = createSvgElement('text');
    label.classList.add('thread-nav__knot-label');
    label.setAttribute('x', '0');
    label.setAttribute('y', '22');
    label.textContent = chapter.label;

    geometry.append(loop, pass, centre);
    group.append(hitArea, geometry, label);
    svg.append(group);

    const scrollToChapter = (event: Event) => {
      event.preventDefault();
      ctx.lenis.scrollTo(`#chapter-${chapter.id}`);
    };

    group.addEventListener('click', scrollToChapter);
    group.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        scrollToChapter(event);
      }
    });

    return { group, hitArea, label };
  });

  const counter = document.createElement('output');
  counter.className = 'thread-nav__counter';
  counter.setAttribute('aria-label', 'Global stitch count');
  counter.setAttribute('aria-live', 'off');
  const counterLabel = document.createElement('span');
  counterLabel.className = 'thread-nav__counter-label';
  counterLabel.setAttribute('aria-hidden', 'true');
  counterLabel.textContent = 'STITCH COUNT';
  const counterValue = document.createElement('span');
  counterValue.className = 'thread-nav__counter-value';
  counterValue.textContent = '0';
  counter.append(counterLabel, counterValue);

  nav.append(svg, counter);
  // Mounted first so its 8 focusable knots precede all chapter content in
  // DOM (and therefore Tab) order, even though chapters mount earlier at
  // runtime. Visual position is unaffected: .thread-nav is fixed with an
  // explicit z-index, so DOM order doesn't change where it renders.
  document.body.prepend(nav);

  const totalScrollVh = metrics.at(-1)?.scrollEndVh ?? 0;
  let viewportWidth = window.innerWidth;
  let viewportHeight = window.innerHeight;
  // The fixed Y-range the scroll-progress path spans — see setGeometry.
  // The one and only quantities `renderThreadProgress` derives its clip
  // rectangle's height from.
  let cornerStartY = THREAD_Y;
  let fullEndY = viewportHeight;
  let currentProgress = 0;
  let idleTimer = 0;
  let idleHasPulsed = false;
  let lastCounterValue = -1;

  // Single deterministic owner of the scroll-progress path's clip state
  // (and the counter position/opacity that rides along it). Pure
  // function of `progress` plus the cached geometry from the most recent
  // setGeometry() — calling it twice with the same progress and the same
  // geometry always writes exactly the same clip rect height, with no
  // dependency on whatever it last wrote. Every trigger (ScrollTrigger's
  // scroll update, its onRefresh after a resize, and the initial
  // synchronous call below) calls this same function; nothing else ever
  // writes to the clip rectangle. The path itself is never translated or
  // redrawn — only how much of its already-fixed geometry is revealed.
  const renderThreadProgress = (progress: number) => {
    currentProgress = Math.min(1, Math.max(0, progress));
    const revealHeight = Math.max(0, fullEndY - cornerStartY) * currentProgress;
    clipRect.setAttribute('height', format(revealHeight));

    const verticalStart = THREAD_Y + TURN_RADIUS;
    const counterStart = Math.min(
      viewportHeight,
      verticalStart + COUNTER_ARC_OFFSET,
    );
    const counterEnd = Math.max(counterStart, viewportHeight - 60);
    const counterY =
      counterStart + currentProgress * (counterEnd - counterStart);
    const counterOpacity =
      currentProgress < 0.01
        ? 0
        : Math.min(1, (currentProgress - 0.01) / 0.01);

    counter.style.setProperty('--thread-tip-y', `${counterY}px`);
    counter.style.opacity = String(counterOpacity);
    counter.classList.toggle('is-at-end', currentProgress >= 0.98);
  };

  const setGeometry = () => {
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;

    const horizontalStart = THREAD_START_X;
    const horizontalEnd = viewportWidth - EDGE_INSET - TURN_RADIUS;
    const verticalX = viewportWidth - EDGE_INSET;
    const verticalStart = THREAD_Y + TURN_RADIUS;
    const verticalTailStart = Math.max(verticalStart, viewportHeight - 8);
    const horizontalPoints = createRunPoints(
      { x: horizontalStart, y: THREAD_Y },
      { x: horizontalEnd, y: THREAD_Y },
      true,
      HORIZONTAL_SEED,
    );
    const verticalPoints = createRunPoints(
      { x: verticalX, y: verticalStart },
      { x: verticalX, y: verticalTailStart },
      false,
      VERTICAL_SEED,
    );
    // Static: the horizontal navbar line only — permanently visible,
    // never dash-animated, unaffected by scroll progress.
    const navbarPathData = [
      `M ${THREAD_START_X - 8} ${THREAD_Y - 2}`,
      `C ${THREAD_START_X - 5} ${THREAD_Y - 3.4} ${THREAD_START_X - 2.5} ${THREAD_Y + 1.2} ${THREAD_START_X} ${THREAD_Y}`,
      smoothRunCommands(horizontalPoints),
    ].join(' ');
    // Scroll-progress path: the corner turn, the complete right vertical
    // continuation, and the original bottom flourish — one fixed, fully-
    // rendered path. Its own `d`, position, and transform never change
    // with scroll; only the clip rectangle below controls how much of it
    // is visible.
    const progressPathData = [
      `M ${format(horizontalEnd)} ${format(THREAD_Y)}`,
      `Q ${format(verticalX)} ${format(THREAD_Y)} ${format(verticalX)} ${format(verticalStart)}`,
      smoothRunCommands(verticalPoints),
      `C ${format(verticalX + 0.4)} ${format(viewportHeight - 4)} ${format(verticalX - 3)} ${format(viewportHeight - 1)} ${format(verticalX - 8)} ${format(viewportHeight)}`,
    ].join(' ');

    svg.setAttribute('viewBox', `0 0 ${viewportWidth} ${viewportHeight}`);
    svg.setAttribute('width', String(viewportWidth));
    svg.setAttribute('height', String(viewportHeight));
    navbarPath.setAttribute('d', navbarPathData);
    progressPath.setAttribute('d', progressPathData);
    progressShadow.setAttribute('d', progressPathData);

    // The clip rectangle spans the full viewport width (so it never
    // constrains the path's own slight left-right wobble) and is fixed
    // at the path's own top (the corner); only its height is scroll-
    // driven, from renderThreadProgress below.
    cornerStartY = THREAD_Y;
    fullEndY = viewportHeight;
    clipRect.setAttribute('x', '0');
    clipRect.setAttribute('y', format(cornerStartY));
    clipRect.setAttribute('width', format(viewportWidth));

    const knotStart = 140;
    const knotEnd = viewportWidth * 0.82;
    const denominator = Math.max(1, knots.length - 1);

    knots.forEach(({ group, hitArea, label }, index) => {
      const ratio = knots.length === 1 ? 0.5 : index / denominator;
      const x = knotStart + (knotEnd - knotStart) * ratio;
      const labelWidth = label.getComputedTextLength();
      const hitWidth = Math.max(17, labelWidth) + 24;
      const hitTop = -18;
      const hitBottom = 37;

      group.setAttribute('transform', `translate(${format(x)} ${THREAD_Y})`);
      hitArea.setAttribute('x', format(-hitWidth / 2));
      hitArea.setAttribute('y', String(hitTop));
      hitArea.setAttribute('width', format(hitWidth));
      hitArea.setAttribute('height', String(hitBottom - hitTop));
    });

    renderThreadProgress(currentProgress);
  };

  const renderProgress = (progress: number, scrollY: number) => {
    renderThreadProgress(progress);

    const actualScrollVh = (scrollY / window.innerHeight) * 100;
    const counterScrollVh = progress * totalScrollVh;
    const active =
      metrics.find(
        ({ scrollStartVh, scrollEndVh }) =>
          actualScrollVh >= scrollStartVh &&
          actualScrollVh < scrollEndVh,
      ) ?? metrics.at(-1);
    const counterChapter =
      metrics.find(
        ({ scrollStartVh, scrollEndVh }) =>
          counterScrollVh >= scrollStartVh &&
          counterScrollVh < scrollEndVh,
      ) ?? metrics.at(-1);

    knots.forEach(({ group }, index) => {
      const isCurrent = index === active?.index;
      const isPassed = actualScrollVh >= metrics[index].scrollStartVh;
      group.classList.toggle('is-current', isCurrent);
      group.classList.toggle('is-passed', isPassed);
      group.classList.toggle('is-upcoming', !isPassed);

      if (isCurrent) {
        group.setAttribute('aria-current', 'step');
      } else {
        group.removeAttribute('aria-current');
      }
    });

    if (!counterChapter) {
      return;
    }

    const localProgress = Math.min(
      1,
      Math.max(
        0,
        (counterScrollVh - counterChapter.scrollStartVh) /
          (counterChapter.scrollEndVh - counterChapter.scrollStartVh),
      ),
    );
    const maxScroll = ScrollTrigger.maxScroll(window);
    const atMaximumScroll = scrollY >= maxScroll - 0.5 || progress >= 1;
    const value = atMaximumScroll
      ? ctx.stitchTotal
      : Math.round(
          counterChapter.stitchStart +
            localProgress *
              (counterChapter.stitchEnd - counterChapter.stitchStart),
        );

    // Only touch the DOM when the displayed integer actually changes —
    // scroll fires far more often than the rounded stitch value does.
    if (value !== lastCounterValue) {
      lastCounterValue = value;
      counter.dataset.value = String(value);
      counterValue.textContent = value.toLocaleString('en-IN');
    }
  };

  const resetIdleTimer = () => {
    window.clearTimeout(idleTimer);
    nav.classList.remove('is-idle-pulse');
    idleHasPulsed = false;

    if (ctx.reducedMotion) {
      return;
    }

    idleTimer = window.setTimeout(() => {
      if (!idleHasPulsed) {
        idleHasPulsed = true;
        nav.classList.add('is-idle-pulse');
      }
    }, IDLE_DELAY_MS);
  };

  // Delegated on nav (animationend bubbles) rather than attached to any
  // one path, since the idle-pulse animation lives only on the knot
  // geometry — never on the thread paths themselves.
  nav.addEventListener('animationend', () => {
    nav.classList.remove('is-idle-pulse');
  });
  ctx.lenis.on('scroll', resetIdleTimer);

  const trigger = ScrollTrigger.create({
    start: 0,
    end: () => ScrollTrigger.maxScroll(window),
    invalidateOnRefresh: true,
    onUpdate(self) {
      renderProgress(self.progress, self.scroll());
    },
    onRefresh(self) {
      setGeometry();
      renderProgress(self.progress, self.scroll());
    },
  });

  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      setGeometry();
      trigger.refresh();
    });
  });

  setGeometry();
  renderProgress(trigger.progress, trigger.scroll());
  resetIdleTimer();
  void document.fonts.ready.then(setGeometry);

  return nav;
}
