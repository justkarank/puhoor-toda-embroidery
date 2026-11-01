import gsap from 'gsap';
import {
  invalidateSequenceCanvas,
  redrawSequenceCanvas,
  registerSequenceCanvas,
  registerStaticSequenceCanvas,
  updateSequenceCanvas,
} from './sequence';

export function makeElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

export function makeAssetImage(
  source: string,
  alt: string,
  className: string,
): HTMLImageElement {
  const image = new Image();
  image.className = className;
  image.alt = alt;
  image.decoding = 'async';
  image.loading = 'lazy';
  image.addEventListener(
    'error',
    () => {
      image.classList.add('is-missing');
      image.setAttribute('aria-hidden', 'true');
    },
    { once: true },
  );
  image.src = source;
  return image;
}

export function makeSequenceCanvas(label: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const resize = () => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(window.innerWidth * pixelRatio));
    canvas.height = Math.max(1, Math.round(window.innerHeight * pixelRatio));
    invalidateSequenceCanvas(canvas);
    canvas.dispatchEvent(new Event('sequencecanvasresize'));
  };

  canvas.className = 'sequence-canvas';
  canvas.setAttribute('aria-label', label);
  resize();
  window.addEventListener('resize', resize, { passive: true });
  return canvas;
}

export function scrubSequence(
  timeline: gsap.core.Timeline,
  canvas: HTMLCanvasElement,
  name: string,
  frameCount: number,
  start: number,
  duration: number,
  reducedMotion = false,
  representativeFrame = 1,
): void {
  if (reducedMotion) {
    registerStaticSequenceCanvas(name, representativeFrame, canvas);
    canvas.addEventListener('sequencecanvasresize', () => {
      redrawSequenceCanvas(canvas);
    });
    return;
  }

  const state = { progress: 0 };
  registerSequenceCanvas(name, state.progress, canvas);
  canvas.addEventListener('sequencecanvasresize', () => {
    redrawSequenceCanvas(canvas);
  });
  timeline.to(
    state,
    {
      progress: 1,
      duration,
      ease: 'none',
      onUpdate: () => {
        updateSequenceCanvas(name, frameCount, state.progress, canvas);
      },
    },
    start,
  );
}

export function scrubPlateDrift(
  timeline: gsap.core.Timeline,
  root: HTMLElement,
  reducedMotion = false,
): void {
  if (reducedMotion) {
    return;
  }

  root.querySelectorAll<HTMLElement>('.drift-plate').forEach((plate, index) => {
    const direction = index % 2 === 0 ? 1 : -1;
    timeline.fromTo(
      plate,
      { x: -direction * 3, y: direction * 4 },
      { x: direction * 5, y: -direction * 6, duration: 1, ease: 'none' },
      0,
    );
  });
}

// Shared top-occlusion system for flowing (non-pinned) chapters whose
// content must pass beneath the fixed thread-nav without staying readable
// through its labels. One matching-ground gradient per chapter, visible
// only while that chapter's own surface is on screen.
export function mountTopOcclusion(tone: 'ink' | 'cloth'): HTMLElement {
  const occlusion = makeElement(
    'div',
    `chapter-top-occlusion chapter-top-occlusion--${tone}`,
  );
  occlusion.setAttribute('aria-hidden', 'true');
  document.body.append(occlusion);
  return occlusion;
}

export function linkTopOcclusion(
  occlusion: HTMLElement,
  trigger: HTMLElement,
  options?: { startDelayVh?: number },
): void {
  // The chapter surface is exactly one viewport tall, so 'bottom bottom'
  // and 'top top' land on the same scroll position and collapse the
  // range. Span the full transit instead: from the moment the surface
  // first appears at the bottom of the viewport to the moment it fully
  // exits at the top, with a small buffer on each end since the
  // counter-drifted content can render slightly outside the surface's
  // own geometric bounds (the chapter is `overflow: visible`).
  //
  // `startDelayVh` pushes that start later by an extra viewport-relative
  // amount. `top bottom+=40`'s own document-position math assumes the
  // immediately preceding chapter is unpinned (or, if pinned, has already
  // finished its own content story by the time its pin releases) — for a
  // preceding chapter that's both pinned AND still visually busy right up
  // to release (its own choreography completing exactly as the pin lets
  // go), this trigger's default start lands almost exactly at that
  // release point, giving the outgoing chapter's release-tail content
  // effectively no room to scroll clear of the nav before this chapter's
  // own occlusion snaps to full opacity on top of it.
  // 'bottom+=X' shifts the viewport-bottom reference point *down* (below
  // the visible edge, into not-yet-scrolled-to territory), which makes
  // the trigger fire *earlier* (smaller scrollY) since the trigger's own
  // top only needs to reach that lower point, not the true edge. Delaying
  // therefore means *reducing* that offset — going negative ('-=') once
  // the delay exceeds the base 40px buffer — not adding to it.
  const offsetPx = () => 40 - (window.innerHeight * (options?.startDelayVh ?? 0)) / 100;

  gsap
    .timeline({
      scrollTrigger: {
        trigger,
        start: () => `top bottom${offsetPx() >= 0 ? '+=' : '-='}${Math.abs(offsetPx())}`,
        end: 'bottom top-=120',
        scrub: 0.3,
      },
    })
    .fromTo(
      occlusion,
      { opacity: 0 },
      { opacity: 1, duration: 0.04, ease: 'none' },
      0,
    )
    .to(occlusion, { opacity: 1, duration: 0.92, ease: 'none' }, 0.04)
    .to(occlusion, { opacity: 0, duration: 0.04, ease: 'none' }, 0.96);
}

export function finishTimeline(
  timeline: gsap.core.Timeline,
  target: HTMLElement,
): void {
  timeline.set(target, {}, 1);
}
