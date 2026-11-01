import {
  loadStaticSequenceFrame,
  loadSequenceWithProgress,
  SEQUENCE_FRAME_COUNTS,
  type SequenceProgress,
} from './sequence';
import type { ChapterContext } from './types';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function createGate(): {
  element: HTMLElement;
  thread: SVGPathElement;
  counter: HTMLOutputElement;
} {
  const element = document.createElement('div');
  element.className = 'preloader';
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');
  element.setAttribute('aria-label', 'Loading the exhibition');

  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.classList.add('preloader__thread');
  svg.setAttribute('viewBox', '0 0 24 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');

  const thread = document.createElementNS(SVG_NAMESPACE, 'path');
  thread.setAttribute('d', 'M 12 0 C 11.7 22 12.3 43 12 61 C 11.6 77 12.2 89 12 100');
  thread.setAttribute('pathLength', '100');
  thread.setAttribute('fill', 'none');
  thread.setAttribute('stroke-dasharray', '100');
  thread.setAttribute('stroke-dashoffset', '100');
  svg.append(thread);

  const counter = document.createElement('output');
  counter.className = 'preloader__counter type-counter';
  counter.value = '0';
  counter.textContent = '0';

  const label = document.createElement('span');
  label.className = 'preloader__label type-label';
  label.textContent = 'STITCHES';

  element.append(svg, counter, label);
  document.body.append(element);
  return { element, thread, counter };
}

function byteProgress(progress: SequenceProgress): number {
  if (progress.complete) {
    return progress.available ? 1 : 0;
  }

  if (
    progress.totalBytes <= 0 ||
    progress.discoveredFrames <= 0 ||
    progress.frameCount <= 0
  ) {
    return 0;
  }

  const discoveredRatio = progress.discoveredFrames / progress.frameCount;
  const transferredRatio = progress.loadedBytes / progress.totalBytes;
  return Math.min(0.995, discoveredRatio * transferredRatio);
}

function renderProgress(
  progress: number,
  stitchTotal: number,
  thread: SVGPathElement,
  counter: HTMLOutputElement,
): void {
  const bounded = Math.min(1, Math.max(0, progress));
  const count = Math.round(stitchTotal * bounded);
  thread.style.strokeDashoffset = String(100 - bounded * 100);
  counter.value = String(count);
  counter.textContent = count.toLocaleString('en-IN');
  counter.style.setProperty('--preloader-progress', String(bounded));
}

export async function runPreloaderGate(ctx: ChapterContext): Promise<void> {
  if (ctx.reducedMotion) {
    await loadStaticSequenceFrame('hero', 1);
    return;
  }

  const frameCount = SEQUENCE_FRAME_COUNTS.hero;
  const { element, thread, counter } = createGate();
  const root = document.documentElement;
  let highestProgress = 0;

  root.classList.add('is-preloading');
  document.body.classList.add('is-preloading');

  const frames = await loadSequenceWithProgress(
    'hero',
    frameCount,
    (state) => {
      highestProgress = Math.max(highestProgress, byteProgress(state));
      renderProgress(highestProgress, ctx.stitchTotal, thread, counter);
    },
  );

  if (frames.length > 0) {
    renderProgress(1, ctx.stitchTotal, thread, counter);
    element.classList.add('is-complete');
    await new Promise<void>((resolve) => {
      const finish = () => resolve();
      element.addEventListener('transitionend', finish, { once: true });
      window.setTimeout(finish, ctx.reducedMotion ? 0 : 360);
    });
  }

  element.remove();
  root.classList.remove('is-preloading');
  document.body.classList.remove('is-preloading');
}
