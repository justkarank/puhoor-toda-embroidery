export interface TextRevealOptions {
  position?: number | string;
  duration?: number;
  stagger?: number;
  yPercent?: number;
}

const LINE_TOLERANCE_PX = 2;

function cubicCoordinate(
  time: number,
  firstControl: number,
  secondControl: number,
): number {
  const inverse = 1 - time;
  return (
    3 * inverse * inverse * time * firstControl +
    3 * inverse * time * time * secondControl +
    time * time * time
  );
}

function easeIn(progress: number): number {
  let lower = 0;
  let upper = 1;
  let time = progress;

  for (let iteration = 0; iteration < 12; iteration += 1) {
    time = (lower + upper) / 2;
    const x = cubicCoordinate(time, 0.16, 0.3);

    if (x < progress) {
      lower = time;
    } else {
      upper = time;
    }
  }

  return cubicCoordinate(time, 1, 1);
}

function makeLine(text: string): HTMLSpanElement {
  const mask = document.createElement('span');
  mask.className = 'text-reveal__line';
  mask.setAttribute('aria-hidden', 'true');

  const inner = document.createElement('span');
  inner.className = 'text-reveal__line-inner';
  inner.textContent = text;
  mask.append(inner);
  return mask;
}

export function splitTextIntoLines(element: HTMLElement): HTMLElement[] {
  const source = element.dataset.revealSource ?? element.textContent?.trim() ?? '';

  if (!source) {
    return [];
  }

  element.dataset.revealSource = source;
  element.setAttribute('aria-label', source);
  element.replaceChildren();

  const words = source.split(/\s+/);
  const measurement = document.createElement('span');
  measurement.className = 'text-reveal__measure';
  measurement.setAttribute('aria-hidden', 'true');
  const wordElements = words.map((word, index) => {
    const span = document.createElement('span');
    span.textContent = word;
    measurement.append(span);

    if (index < words.length - 1) {
      measurement.append(document.createTextNode(' '));
    }

    return span;
  });
  element.append(measurement);

  const lines: string[][] = [];
  let currentTop: number | undefined;

  wordElements.forEach((word) => {
    const top = word.getBoundingClientRect().top;

    if (
      currentTop === undefined ||
      Math.abs(top - currentTop) > LINE_TOLERANCE_PX
    ) {
      lines.push([]);
      currentTop = top;
    }

    lines.at(-1)?.push(word.textContent ?? '');
  });

  const masks = lines.map((line) => makeLine(line.join(' ')));
  element.replaceChildren(...masks);
  return masks.map(
    (mask) =>
      mask.querySelector<HTMLElement>('.text-reveal__line-inner') ?? mask,
  );
}

export interface BlockRevealOptions {
  position: number;
  duration: number;
  translateY?: number;
}

// Whole-block reveal for copy that must never show a fragment of a later
// line before its own reveal window: no per-word measurement, no line
// splitting, so there is nothing that can desync from a late web-font
// swap. The hidden state is applied synchronously (before ScrollTrigger's
// first render) so there is no gap where the raw text is visible.
export function initBlockReveal(element: HTMLElement, translateY = 10): void {
  element.style.visibility = 'hidden';
  element.style.opacity = '0';
  element.style.transform = `translateY(${translateY}px)`;
  element.style.clipPath = 'inset(0 0 100% 0)';
}

export function addBlockReveal(
  timeline: gsap.core.Timeline,
  element: HTMLElement,
  options: BlockRevealOptions,
): void {
  const translateY = options.translateY ?? 10;
  timeline.set(element, { visibility: 'visible' }, options.position);
  timeline.fromTo(
    element,
    { opacity: 0, y: translateY, clipPath: 'inset(0 0 100% 0)' },
    {
      opacity: 1,
      y: 0,
      clipPath: 'inset(0 0 0% 0)',
      duration: options.duration,
      ease: 'none',
    },
    options.position,
  );
}

export function addTextReveal(
  timeline: gsap.core.Timeline,
  targets: HTMLElement | readonly HTMLElement[],
  options: TextRevealOptions = {},
): HTMLElement[] {
  const elements = Array.isArray(targets) ? targets : [targets];
  const lines = elements.flatMap((element) => splitTextIntoLines(element));

  if (lines.length === 0) {
    return lines;
  }

  timeline.fromTo(
    lines,
    { yPercent: options.yPercent ?? 112 },
    {
      yPercent: 0,
      duration: options.duration ?? 0.56,
      stagger: options.stagger ?? 0.06,
      ease: easeIn,
    },
    options.position ?? 0,
  );

  return lines;
}
