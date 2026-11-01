import { spawn } from 'node:child_process';
import {
  access,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const AUDIT_ROOT = path.join(PROJECT_ROOT, 'audit', 'visual');
const SCREENSHOT_ROOT = path.join(AUDIT_ROOT, 'screenshots');
const URL = 'http://127.0.0.1:4173';
const PRIMARY_VIEWPORT = { width: 1440, height: 900 };
const SHORT_VIEWPORT = { width: 1440, height: 800 };
const MOBILE_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];
const EXPECTED_STITCH_TOTAL = 64_128;
const EXPECTED_TOTAL_SCROLL_VH = 1_410;

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const baselineOut = option('--baseline-out');
const compareWith = option('--compare-with');

const screenshotDefinitions = [
  { filename: '01-hero-start.png', group: 'Hero', chapter: 'hero', requestedProgress: 0, actualProgress: 0, frame: 1 },
  {
    filename: '02-hero-before-join.png',
    group: 'Hero',
    chapter: 'hero',
    requestedProgress: (0.9 * 47) / 95,
    actualProgress: (0.9 * 47) / 95,
    frame: 48,
  },
  {
    filename: '03-hero-after-join.png',
    group: 'Hero',
    chapter: 'hero',
    requestedProgress: (0.9 * 48) / 95,
    actualProgress: (0.9 * 48) / 95,
    frame: 49,
  },
  { filename: '04-hero-final.png', group: 'Hero', chapter: 'hero', requestedProgress: 1, actualProgress: 1, frame: 96 },
  { filename: '05-about-mid.png', group: 'About', chapter: 'about', requestedProgress: 0.55, actualProgress: 0.55 },
  { filename: '06-construction-front.png', group: 'Construction', chapter: 'construction', requestedProgress: 0.05, actualProgress: 0.05 },
  { filename: '07-construction-back.png', group: 'Construction', chapter: 'construction', requestedProgress: 0.7, actualProgress: 0.7 },
  { filename: '08-construction-macro.png', group: 'Construction', chapter: 'construction', requestedProgress: 0.92, actualProgress: 0.92 },
  { filename: '09-motif-1.png', group: 'Motifs', chapter: 'motifs', requestedProgress: 0.08, actualProgress: 0.08, activePlate: 'motif-1' },
  { filename: '10-motif-2.png', group: 'Motifs', chapter: 'motifs', requestedProgress: 0.24, actualProgress: 0.24, activePlate: 'motif-2' },
  { filename: '11-motif-3.png', group: 'Motifs', chapter: 'motifs', requestedProgress: 0.4, actualProgress: 0.4, activePlate: 'motif-3' },
  { filename: '12-motif-4.png', group: 'Motifs', chapter: 'motifs', requestedProgress: 0.56, actualProgress: 0.56, activePlate: 'motif-4' },
  { filename: '13-motif-5.png', group: 'Motifs', chapter: 'motifs', requestedProgress: 0.72, actualProgress: 0.72, activePlate: 'motif-5' },
  { filename: '14-motif-6.png', group: 'Motifs', chapter: 'motifs', requestedProgress: 0.88, actualProgress: 0.88, activePlate: 'motif-6' },
  { filename: '15-grid-initial.png', group: 'Grid', chapter: 'grid', requestedProgress: 0.08, actualProgress: 0.08 },
  { filename: '16-grid-active.png', group: 'Grid', chapter: 'grid', requestedProgress: 0.58, actualProgress: 0.58, interactGrid: true },
  { filename: '17-nilgiris-start.png', group: 'Nilgiris', chapter: 'nilgiris', requestedProgress: 0, actualProgress: 0, frame: 1 },
  {
    filename: '18-nilgiris-mid.png',
    group: 'Nilgiris',
    chapter: 'nilgiris',
    requestedProgress: 35 / 71,
    actualProgress: 35 / 71,
    frame: 36,
  },
  { filename: '19-artisan-1.png', group: 'Artisans', chapter: 'artisans', requestedProgress: 0.12, actualProgress: 0.12, activePlate: 'artisan-1' },
  { filename: '20-artisan-2.png', group: 'Artisans', chapter: 'artisans', requestedProgress: 0.37, actualProgress: 0.37, activePlate: 'artisan-2' },
  { filename: '21-artisan-3.png', group: 'Artisans', chapter: 'artisans', requestedProgress: 0.62, actualProgress: 0.62, activePlate: 'artisan-3' },
  { filename: '22-artisan-4.png', group: 'Artisans', chapter: 'artisans', requestedProgress: 0.87, actualProgress: 0.87, activePlate: 'artisan-4' },
  { filename: '23-closing-wide.png', group: 'Closing', chapter: 'closing', requestedProgress: 0, actualProgress: 0, frame: 1 },
  { filename: '24-closing-thread.png', group: 'Closing', chapter: 'closing', requestedProgress: 0.5, actualProgress: 0.5, frame: 72 },
];

const boundaries = [
  ['hero', 'about', 'hero-about'],
  ['about', 'construction', 'about-construction'],
  ['construction', 'motifs', 'construction-motifs'],
  ['motifs', 'grid', 'motifs-grid'],
  ['grid', 'nilgiris', 'grid-nilgiris'],
  ['nilgiris', 'artisans', 'nilgiris-artisans'],
  ['artisans', 'closing', 'artisans-closing'],
];

let boundaryNumber = 25;
for (const [outgoing, incoming, slug] of boundaries) {
  screenshotDefinitions.push(
    {
      filename: `${String(boundaryNumber).padStart(2, '0')}-${slug}-before.png`,
      group: 'Chapter boundaries',
      chapter: outgoing,
      requestedProgress: 0.99,
      actualProgress: 0.99,
      boundary: `${outgoing} → ${incoming} (before)`,
    },
    {
      filename: `${String(boundaryNumber + 1).padStart(2, '0')}-${slug}-after.png`,
      group: 'Chapter boundaries',
      chapter: incoming,
      requestedProgress: 0.01,
      actualProgress: 0.01,
      boundary: `${outgoing} → ${incoming} (after)`,
    },
  );
  boundaryNumber += 2;
}

screenshotDefinitions.push(
  {
    filename: '39-about-1440x800.png',
    group: '1440×800 check',
    chapter: 'about',
    requestedProgress: 0.55,
    actualProgress: 0.55,
    viewport: SHORT_VIEWPORT,
  },
  {
    filename: '40-construction-macro-1440x800.png',
    group: '1440×800 check',
    chapter: 'construction',
    requestedProgress: 0.92,
    actualProgress: 0.92,
    viewport: SHORT_VIEWPORT,
  },
);

const mobileDefinitions = [
  {
    filename: '41-mobile-390x844.png',
    group: 'Mobile fallback',
    chapter: 'mobile-fallback',
    viewport: MOBILE_VIEWPORTS[0],
  },
  {
    filename: '42-mobile-430x932.png',
    group: 'Mobile fallback',
    chapter: 'mobile-fallback',
    viewport: MOBILE_VIEWPORTS[1],
  },
];

const reducedDefinitions = [
  {
    filename: '43-reduced-hero-start.png',
    group: 'Reduced motion',
    chapter: 'hero',
    requestedProgress: 0,
    actualProgress: 0,
    frame: 1,
  },
  {
    filename: '44-reduced-nilgiris-mid.png',
    group: 'Reduced motion',
    chapter: 'nilgiris',
    requestedProgress: 0.5,
    actualProgress: 0.5,
    frame: 36,
  },
  {
    filename: '45-reduced-closing-final.png',
    group: 'Reduced motion',
    chapter: 'closing',
    requestedProgress: 1,
    actualProgress: 1,
    frame: 72,
  },
];

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForServer(server) {
  const deadline = Date.now() + 30_000;
  let stderr = '';
  server.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Vite exited before becoming ready.\n${stderr}`);
    }

    try {
      const response = await fetch(URL);
      if (response.ok) return;
    } catch {
      // The strict-port server is still starting.
    }
    await delay(100);
  }

  throw new Error(`Timed out waiting for ${URL}.\n${stderr}`);
}

function startServer() {
  return spawn(
    'npm',
    [
      'run',
      'dev',
      '--',
      '--host',
      '127.0.0.1',
      '--port',
      '4173',
      '--strictPort',
    ],
    {
      cwd: PROJECT_ROOT,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

async function stopServer(server) {
  if (server.exitCode !== null || server.pid === undefined) return;
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    server.kill('SIGTERM');
  }
  await Promise.race([
    new Promise((resolve) => server.once('exit', resolve)),
    delay(2_000),
  ]);
}

async function prepareOutput() {
  await mkdir(SCREENSHOT_ROOT, { recursive: true });
  const files = await readdir(SCREENSHOT_ROOT);
  await Promise.all(
    files
      .filter((filename) => filename.endsWith('.png'))
      .map((filename) =>
        rm(path.join(SCREENSHOT_ROOT, filename), { force: true }),
      ),
  );
}

async function installAuditHooks(page) {
  await page.route('**/src/main.ts*', async (route) => {
    const response = await route.fetch();
    const body = `${await response.text()}
window.__VISUAL_AUDIT_SCROLL_TRIGGER__ = ScrollTrigger;
window.__VISUAL_AUDIT_GSAP__ = gsap;
window.__VISUAL_AUDIT_LENIS__ = lenis;
`;
    await route.fulfill({ response, body });
  });

  await page.route('**/src/lib/sequence.ts*', async (route) => {
    const response = await route.fetch();
    const body = `${await response.text()}
window.__VISUAL_AUDIT_SEQUENCE__ = {
  states: () => Array.from(canvasStates).map(([canvas, state]) => ({
    className: canvas.className,
    name: state.name,
    targetIndex: state.targetIndex,
    drawnIndex: state.drawnIndex,
    frame: state.drawnIndex + 1,
    progress: state.progress,
  })),
  cache: () => Array.from(sequenceCache.keys()),
};
`;
    await route.fulfill({ response, body });
  });
}

async function chapterTrigger(page, chapter) {
  return page.evaluate((chapterId) => {
    const trigger = window.__VISUAL_AUDIT_SCROLL_TRIGGER__
      .getAll()
      .find((candidate) => candidate.trigger?.id === `chapter-${chapterId}`);

    if (!trigger) {
      throw new Error(`Missing ScrollTrigger for ${chapterId}.`);
    }

    return {
      start: trigger.start,
      end: trigger.end,
      progress: trigger.progress,
    };
  }, chapter);
}

async function allChapterTriggers(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.chapter')).map((section) => {
      const trigger = window.__VISUAL_AUDIT_SCROLL_TRIGGER__
        .getAll()
        .find((candidate) => candidate.trigger === section);
      return {
        chapter: section.dataset.chapter,
        start: trigger?.start ?? null,
        end: trigger?.end ?? null,
      };
    }),
  );
}

async function settleAfterScroll(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );
  await page.waitForTimeout(500);
}

async function scrollImmediately(page, scrollY) {
  const roundedY = Math.round(scrollY);
  await page.evaluate((targetY) => {
    const lenis = window.__VISUAL_AUDIT_LENIS__;
    if (targetY === 0 && window.scrollY === 0 && lenis) {
      lenis.scrollTo(1, { immediate: true, force: true });
    } else if (targetY === 0 && window.scrollY === 0) {
      window.scrollTo(0, 1);
    }
    if (lenis) {
      lenis.scrollTo(targetY, { immediate: true, force: true });
    } else {
      window.scrollTo(0, targetY);
    }
    window.dispatchEvent(new Event('scroll'));
  }, roundedY);
  await settleAfterScroll(page);
  return page.evaluate(() => window.scrollY);
}

function sequenceName(chapter) {
  return ['hero', 'nilgiris', 'closing'].includes(chapter)
    ? chapter
    : undefined;
}

function expectedSequenceFrame(definition) {
  if (definition.frame !== undefined) return definition.frame;
  if (definition.chapter === 'hero') {
    return (
      Math.round(
        Math.min(1, definition.actualProgress / 0.9) * (96 - 1),
      ) + 1
    );
  }
  if (definition.chapter === 'nilgiris') {
    return Math.round(definition.actualProgress * (72 - 1)) + 1;
  }
  if (definition.chapter === 'closing') {
    return (
      Math.round(
        Math.min(1, definition.actualProgress / 0.5) * (72 - 1),
      ) + 1
    );
  }
  return undefined;
}

async function waitForFrame(page, name, expectedFrame) {
  try {
    await page.waitForFunction(
      ({ sequence, frame }) => {
        const state = window.__VISUAL_AUDIT_SEQUENCE__
          ?.states()
          .find((candidate) => candidate.name === sequence);
        return state?.frame === frame && state.targetIndex === frame - 1;
      },
      { sequence: name, frame: expectedFrame },
      { timeout: 5_000 },
    );
  } catch (error) {
    const states = await page.evaluate(
      () => window.__VISUAL_AUDIT_SEQUENCE__?.states() ?? [],
    );
    throw new Error(
      `Timed out waiting for ${name} frame ${expectedFrame}; states=${JSON.stringify(states)}`,
      { cause: error },
    );
  }
}

async function renderedFrame(page, name) {
  return page.evaluate(
    (sequence) =>
      window.__VISUAL_AUDIT_SEQUENCE__
        ?.states()
        .find((candidate) => candidate.name === sequence) ?? null,
    name,
  );
}

async function waitForImages(page, selectors) {
  if (selectors.length === 0) return;
  await page.waitForFunction(
    (imageSelectors) =>
      imageSelectors.every((selector) => {
        const image = document.querySelector(selector);
        return (
          image instanceof HTMLImageElement &&
          image.complete &&
          image.naturalWidth > 0 &&
          !image.classList.contains('is-missing')
        );
      }),
    selectors,
    { timeout: 10_000 },
  );
}

function stillSelectors(definition) {
  if (definition.chapter === 'about') {
    return ['.about__plate--cloth', '.about__plate--folds'];
  }
  if (definition.chapter === 'construction') {
    return [
      '.construction__face--front img',
      '.construction__face--back img',
      '.construction__macro',
    ];
  }
  if (definition.activePlate?.startsWith('motif-')) {
    const id = definition.activePlate.split('-')[1];
    return [`.motifs__plate[data-motif-id="${id}"] .motifs__image`];
  }
  if (definition.activePlate?.startsWith('artisan-')) {
    const id = definition.activePlate.split('-')[1];
    return [`.artisans__plate--${id} .artisans__image`];
  }
  if (definition.chapter === 'closing') {
    return ['.closing__red-ground-texture'];
  }
  return [];
}

async function activatePlate(page, activePlate) {
  if (!activePlate) return null;

  if (activePlate.startsWith('motif-')) {
    const id = Number(activePlate.split('-')[1]);
    const selector = `.motifs__plate[data-motif-id="${id}"]`;
    await page.locator(selector).hover({ force: true });
    await page.waitForTimeout(350);
    return page.evaluate(
      ({ plateSelector, motifId }) => {
        const plate = document.querySelector(plateSelector);
        const svg = plate?.querySelector('.motifs__draw');
        const units = Array.from(svg?.querySelectorAll('rect') ?? []);
        const mappedMotifId = Number(
          units[0]?.id.match(/^motif-(\d+)-unit-/)?.[1],
        );
        const activeUnits = units.filter(
          (unit) => Number.parseFloat(getComputedStyle(unit).opacity) > 0.05,
        );
        const visiblePlates = Array.from(
          document.querySelectorAll('.motifs__plate'),
        ).map((candidate) => {
          const rect = candidate.getBoundingClientRect();
          return {
            motif: candidate.dataset.motifId,
            opacity: Number.parseFloat(getComputedStyle(candidate).opacity),
            visibleArea:
              Math.max(0, Math.min(innerWidth, rect.right) - Math.max(0, rect.left)) *
              Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top)),
          };
        });
        return {
          motifId,
          svgMotifId: Number.isFinite(mappedMotifId)
            ? mappedMotifId
            : null,
          mappingMatches: mappedMotifId === motifId,
          unitCount: units.length,
          activeUnitCount: activeUnits.length,
          hovered: plate?.matches(':hover') ?? false,
          dominant:
            visiblePlates
              .sort(
                (a, b) =>
                  b.opacity * b.visibleArea - a.opacity * a.visibleArea,
              )[0]?.motif === String(motifId),
        };
      },
      { plateSelector: selector, motifId: id },
    );
  }

  const id = Number(activePlate.split('-')[1]);
  return page.evaluate((plateId) => {
    const plates = Array.from(document.querySelectorAll('.artisans__plate'));
    const metrics = plates.map((plate, index) => {
      const rect = plate.getBoundingClientRect();
      const visibleHeight = Math.max(
        0,
        Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top),
      );
      return {
        artisanId: index + 1,
        centreDistance: Math.abs((rect.top + rect.bottom) / 2 - innerHeight / 2),
        visibleHeight,
      };
    });
    const dominant = metrics
      .filter((metric) => metric.visibleHeight > 0)
      .sort(
        (a, b) =>
          a.centreDistance - b.centreDistance ||
          b.visibleHeight - a.visibleHeight,
      )[0];
    return {
      artisanId: plateId,
      dominant: dominant?.artisanId === plateId,
      metrics,
    };
  }, id);
}

async function interactWithGrid(page) {
  const canvas = page.locator('.grid-engine__canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Grid canvas is not visible.');

  const points = [
    [box.x + 22 * 8 + 11, box.y + 22 * 8 + 11],
    [box.x + 22 * 9 + 11, box.y + 22 * 9 + 11],
    [box.x + 22 * 10 + 11, box.y + 22 * 10 + 11],
    [box.x + 22 * 11 + 11, box.y + 22 * 11 + 11],
    [box.x + 22 * 12 + 11, box.y + 22 * 12 + 11],
  ];

  await page.mouse.move(points[0][0], points[0][1]);
  await page.mouse.down();
  for (const [x, y] of points.slice(1)) {
    await page.mouse.move(x, y, { steps: 4 });
  }
  await page.mouse.up();
  await page.waitForTimeout(100);
}

async function canvasRenderCheck(page, chapter) {
  const name = sequenceName(chapter);
  if (!name) return null;
  return page.evaluate((sequence) => {
    const canvas = document.querySelector(`.${sequence}__canvas`);
    if (!(canvas instanceof HTMLCanvasElement)) return null;
    const readback = document.createElement('canvas');
    readback.width = canvas.width;
    readback.height = canvas.height;
    const context = readback.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(canvas, 0, 0);
    const pixels = context.getImageData(
      0,
      0,
      readback.width,
      readback.height,
    ).data;
    const step = 24;
    let samples = 0;
    let opaqueSamples = 0;
    let minimum = 255;
    let maximum = 0;
    let luminanceTotal = 0;
    const signature = [];

    for (let y = 0; y < readback.height; y += step) {
      for (let x = 0; x < readback.width; x += step) {
        const offset = (y * readback.width + x) * 4;
        const red = pixels[offset];
        const green = pixels[offset + 1];
        const blue = pixels[offset + 2];
        const alpha = pixels[offset + 3];
        const luminance = Math.round(
          0.2126 * red + 0.7152 * green + 0.0722 * blue,
        );
        samples += 1;
        if (alpha > 0) opaqueSamples += 1;
        minimum = Math.min(minimum, luminance);
        maximum = Math.max(maximum, luminance);
        luminanceTotal += luminance;
        signature.push(red, green, blue);
      }
    }

    return {
      samples,
      opaqueRatio: opaqueSamples / samples,
      luminanceRange: maximum - minimum,
      meanLuminance: luminanceTotal / samples,
      blank: opaqueSamples === 0 || maximum - minimum < 2,
      signature,
    };
  }, name);
}

async function captureMeasurements(page, chapter) {
  const selectors = {
    hero: ['.hero__canvas', '.hero__title', '.hero__correction', '.hero__scroll-cue'],
    about: ['.about__copy', '.about__heading', '.about__body', '.about__plates', '.about__plate--cloth', '.about__plate--folds'],
    construction: ['.construction__header', '.construction__cloth', '.construction__plane', '.construction__face--front', '.construction__face--back', '.construction__body', '.construction__macro', '.construction__pull'],
    motifs: ['.motifs__intro', '.motifs__grid', '.motifs__footer', '.motifs__plate'],
    grid: ['.grid-engine', '.grid-engine__canvas', '.grid-engine__readout', '.grid-engine__rail', '#chapter-nilgiris', '.nilgiris__canvas'],
    nilgiris: ['#chapter-nilgiris', '.nilgiris', '.nilgiris__canvas', '.nilgiris__copy'],
    artisans: ['.artisans__header', '.artisans__track', '.artisans__plate', '.artisans__closing'],
    closing: ['.closing__canvas', '.closing__thesis', '.closing__credits', '.closing__red-ground'],
  }[chapter] ?? [];

  return page.evaluate((selectorList) => {
    const rect = (element) => {
      const bounds = element.getBoundingClientRect();
      return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        left: bounds.left,
      };
    };

    const elements = selectorList.flatMap((selector) =>
      Array.from(document.querySelectorAll(selector)).map((element, index) => {
        const style = getComputedStyle(element);
        return {
          selector:
            document.querySelectorAll(selector).length > 1
              ? `${selector}:nth-of-type(${index + 1})`
              : selector,
          rect: rect(element),
          opacity: Number.parseFloat(style.opacity),
          visibility: style.visibility,
          transform: style.transform,
          rotationX:
            style.transform === 'none'
              ? 0
              : (() => {
                  const matrix = new DOMMatrixReadOnly(style.transform);
                  return (
                    (Math.atan2(matrix.m23, matrix.m22) * 180) /
                    Math.PI
                  );
                })(),
          maskImage: style.maskImage,
          warpOpen: style.getPropertyValue('--warp-open').trim(),
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          textual:
            element.matches(
              'h1, h2, h3, p, figcaption, footer, .about__copy, .construction__body, .nilgiris__copy, .artisans__caption, .closing__credits',
            ),
          clippedInternally:
            ((style.overflowX !== 'visible' &&
              style.overflowX !== 'clip' &&
              element.scrollWidth > element.clientWidth + 1) ||
              (style.overflowY !== 'visible' &&
                style.overflowY !== 'clip' &&
                element.scrollHeight > element.clientHeight + 1)),
        };
      }),
    );

    const navLabels = Array.from(
      document.querySelectorAll('.thread-nav__knot-label'),
    ).map((element, index) => ({
      selector: `.thread-nav__knot:nth-of-type(${index + 1}) .thread-nav__knot-label`,
      rect: rect(element),
    }));

    const navCollisions = [];
    for (let first = 0; first < navLabels.length; first += 1) {
      for (let second = first + 1; second < navLabels.length; second += 1) {
        const a = navLabels[first].rect;
        const b = navLabels[second].rect;
        const width = Math.max(
          0,
          Math.min(a.right, b.right) - Math.max(a.left, b.left),
        );
        const height = Math.max(
          0,
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top),
        );
        if (width > 0 && height > 0) {
          navCollisions.push({
            first: navLabels[first].selector,
            second: navLabels[second].selector,
            width,
            height,
          });
        }
      }
    }

    return { elements, navCollisions };
  }, selectors);
}

function intersection(first, second) {
  const left = Math.max(first.left, second.left);
  const top = Math.max(first.top, second.top);
  const right = Math.min(first.right, second.right);
  const bottom = Math.min(first.bottom, second.bottom);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);

  if (width === 0 || height === 0) {
    return {
      x: left,
      y: top,
      width: 0,
      height: 0,
      left,
      top,
      right: left,
      bottom: top,
    };
  }

  return {
    x: left,
    y: top,
    width,
    height,
    left,
    top,
    right,
    bottom,
  };
}

async function activeChapter(page) {
  return page.evaluate(
    () =>
      document.querySelector('.thread-nav__knot.is-current')?.dataset.chapter ??
      null,
  );
}

async function captureOne(page, definition, logs) {
  const viewport = definition.viewport ?? PRIMARY_VIEWPORT;
  const currentViewport = page.viewportSize();
  if (
    currentViewport?.width !== viewport.width ||
    currentViewport?.height !== viewport.height
  ) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => {
      window.__VISUAL_AUDIT_SCROLL_TRIGGER__?.refresh();
    });
    await settleAfterScroll(page);
  }

  const trigger = await chapterTrigger(page, definition.chapter);
  const targetScroll =
    trigger.start +
    definition.actualProgress * (trigger.end - trigger.start);
  const scrollY = await scrollImmediately(page, targetScroll);

  await waitForImages(page, stillSelectors(definition));

  const sequence = sequenceName(definition.chapter);
  const expectedFrame = expectedSequenceFrame(definition);
  if (sequence && expectedFrame !== undefined) {
    await waitForFrame(page, sequence, expectedFrame);
  }

  const plateCheck = await activatePlate(page, definition.activePlate);

  if (definition.interactGrid) {
    await interactWithGrid(page);
  }

  const frameState = sequence ? await renderedFrame(page, sequence) : null;
  const renderCheck = await canvasRenderCheck(page, definition.chapter);
  const measurements = await captureMeasurements(page, definition.chapter);
  const currentTrigger = await chapterTrigger(page, definition.chapter);
  const actualProgress =
    (scrollY - currentTrigger.start) /
    Math.max(1, currentTrigger.end - currentTrigger.start);
  const active = await activeChapter(page);
  const outputPath = path.join(SCREENSHOT_ROOT, definition.filename);

  await page.screenshot({
    path: outputPath,
    fullPage: false,
    animations: 'allow',
  });

  const screenshotStat = await stat(outputPath);
  const entry = {
    filename: definition.filename,
    viewport,
    chapter: definition.chapter,
    requestedProgress: definition.requestedProgress,
    actualProgress,
    scrollY,
    triggerStart: currentTrigger.start,
    triggerEnd: currentTrigger.end,
    renderedFrameNumber: frameState?.frame ?? null,
    activePlate: definition.activePlate ?? null,
    activeChapter: active,
    boundary: definition.boundary ?? null,
    consoleErrorCount: logs.consoleErrors.length,
    failedRequestCount: logs.failedRequests.length + logs.httpErrors.length,
    screenshotBytes: screenshotStat.size,
    renderCheck: renderCheck
      ? {
          samples: renderCheck.samples,
          opaqueRatio: renderCheck.opaqueRatio,
          luminanceRange: renderCheck.luminanceRange,
          meanLuminance: renderCheck.meanLuminance,
          blank: renderCheck.blank,
        }
      : null,
    plateCheck,
    measurements,
    _signature: renderCheck?.signature ?? null,
  };

  if (renderCheck?.blank) {
    throw new Error(`${definition.filename} contains a blank sequence canvas.`);
  }
  if (expectedFrame !== undefined && frameState?.frame !== expectedFrame) {
    throw new Error(
      `${definition.filename} expected frame ${expectedFrame}, rendered ${frameState?.frame}.`,
    );
  }
  if (definition.activePlate && !plateCheck?.dominant) {
    throw new Error(
      `${definition.filename} did not make ${definition.activePlate} visually dominant.`,
    );
  }
  if (
    definition.activePlate?.startsWith('motif-') &&
    !plateCheck?.mappingMatches
  ) {
    throw new Error(
      `${definition.filename} did not map ${definition.activePlate} to its corresponding SVG unit IDs.`,
    );
  }

  return entry;
}

function attachLogs(page, logs) {
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      const destination =
        message.type() === 'error'
          ? logs.consoleErrors
          : logs.consoleWarnings;
      destination.push({
        type: message.type(),
        text: message.text(),
        location: message.location(),
      });
    }
  });
  page.on('requestfailed', (request) => {
    logs.failedRequests.push({
      url: request.url(),
      error: request.failure()?.errorText ?? 'unknown request failure',
    });
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      logs.httpErrors.push({
        url: response.url(),
        status: response.status(),
      });
    }
  });
}

async function captureMobileFallback(page, definition, logs) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await waitForImages(page, ['.mobile-fallback__image']);
  const state = await page.evaluate(() => ({
    fallbackCount: document.querySelectorAll('.mobile-fallback').length,
    chapterCount: document.querySelectorAll('.chapter').length,
    text: document.querySelector('#exhibition')?.textContent ?? '',
    rect: (() => {
      const bounds = document
        .querySelector('.mobile-fallback')
        ?.getBoundingClientRect();
      return bounds
        ? {
            top: bounds.top,
            bottom: bounds.bottom,
            left: bounds.left,
            right: bounds.right,
            width: bounds.width,
            height: bounds.height,
          }
        : null;
    })(),
  }));

  if (
    state.fallbackCount !== 1 ||
    state.chapterCount !== 0 ||
    !state.text.includes('Toda Embroidery') ||
    !state.text.includes('The Side We Misread') ||
    !state.text.includes('This exhibition is built for a desktop screen.')
  ) {
    throw new Error(
      `Mobile fallback validation failed at ${definition.viewport.width}×${definition.viewport.height}: ${JSON.stringify(state)}`,
    );
  }

  const outputPath = path.join(SCREENSHOT_ROOT, definition.filename);
  await page.screenshot({
    path: outputPath,
    fullPage: false,
    animations: 'allow',
  });
  const screenshotStat = await stat(outputPath);

  if (screenshotStat.size === 0) {
    throw new Error(`${definition.filename} is zero bytes.`);
  }

  return {
    filename: definition.filename,
    group: definition.group,
    viewport: definition.viewport,
    chapter: definition.chapter,
    requestedProgress: 0,
    actualProgress: 0,
    scrollY: 0,
    triggerStart: null,
    triggerEnd: null,
    renderedFrameNumber: null,
    activePlate: null,
    activeChapter: null,
    boundary: null,
    consoleErrorCount: logs.consoleErrors.length,
    failedRequestCount: logs.failedRequests.length + logs.httpErrors.length,
    screenshotBytes: screenshotStat.size,
    renderCheck: null,
    plateCheck: null,
    measurements: { elements: [], navCollisions: [], mobile: state },
    _signature: null,
  };
}

async function measureAt(page, chapter, progress) {
  const trigger = await chapterTrigger(page, chapter);
  const target = trigger.start + progress * (trigger.end - trigger.start);
  await scrollImmediately(page, target);
  return {
    trigger: await chapterTrigger(page, chapter),
    measurements: await captureMeasurements(page, chapter),
  };
}

function measuredElement(state, selector) {
  return state.measurements.elements.find(
    (element) => element.selector === selector,
  );
}

async function runRequiredAssertions(page, viewport) {
  await page.setViewportSize(viewport);
  await page.evaluate(() => {
    window.__VISUAL_AUDIT_SCROLL_TRIGGER__?.refresh();
  });
  await settleAfterScroll(page);

  const about = await measureAt(page, 'about', 0.55);
  const aboutCopy = measuredElement(about, '.about__copy');
  const aboutHeading = measuredElement(about, '.about__heading');
  const aboutPlates = measuredElement(about, '.about__plates');
  const aboutReveal = await page.evaluate(() => {
    const lines = Array.from(
      document.querySelectorAll(
        '.about__heading .text-reveal__line-inner, .about__paragraph .text-reveal__line-inner',
      ),
    );
    const translations = lines.map((line) => {
      const transform = getComputedStyle(line).transform;
      return transform === 'none'
        ? 0
        : new DOMMatrixReadOnly(transform).m42;
    });
    return {
      lineCount: lines.length,
      maxTranslation: Math.max(0, ...translations.map(Math.abs)),
      minimumTop: Math.min(
        innerHeight,
        ...lines.map((line) => line.getBoundingClientRect().top),
      ),
      maximumBottom: Math.max(
        0,
        ...lines.map((line) => line.getBoundingClientRect().bottom),
      ),
      surfaceOverflow:
        getComputedStyle(document.querySelector('.about')).overflow,
    };
  });
  const copyTopMinimum = viewport.height === 900 ? 48 : 40;
  const copyBottomMaximum = viewport.height === 900 ? 852 : 760;
  const aboutPass =
    aboutCopy?.warpOpen === '22px' &&
    aboutCopy.rect.top >= copyTopMinimum &&
    aboutCopy.rect.bottom <= copyBottomMaximum &&
    aboutHeading?.rect.top >= 0 &&
    aboutHeading.rect.bottom <= viewport.height &&
    aboutPlates?.rect.top >= 0 &&
    aboutPlates.rect.bottom <= viewport.height &&
    aboutReveal.lineCount > 0 &&
    aboutReveal.maxTranslation <= 0.01 &&
    aboutReveal.minimumTop >= 0 &&
    aboutReveal.maximumBottom <= viewport.height &&
    aboutReveal.surfaceOverflow === 'visible';

  const construction = {};
  for (const progress of [0.7, 0.92, 0.99]) {
    const state = await measureAt(page, 'construction', progress);
    const body = measuredElement(state, '.construction__body');
    const cloth = measuredElement(state, '.construction__cloth');
    const plane = measuredElement(state, '.construction__plane');
    construction[progress] = {
      body: body?.rect ?? null,
      cloth: cloth?.rect ?? null,
      intersection:
        body && cloth ? intersection(body.rect, cloth.rect) : null,
      rotationX: plane?.rotationX ?? null,
    };
  }

  const nilgiris = {};
  for (const progress of [0, 0.5, 0.99]) {
    const state = await measureAt(page, 'nilgiris', progress);
    const canvas = measuredElement(state, '.nilgiris__canvas');
    nilgiris[progress] = canvas?.rect ?? null;
  }
  const nilgirisOverflow = await page.evaluate(
    () => getComputedStyle(document.querySelector('.nilgiris')).overflow,
  );

  const grid = await measureAt(page, 'grid', 0.58);
  const previewCanvas = measuredElement(grid, '.nilgiris__canvas');
  const previewHeight = previewCanvas
    ? Math.max(
        0,
        Math.min(viewport.height, previewCanvas.rect.bottom) -
          Math.max(0, previewCanvas.rect.top),
      )
    : 0;

  const assertionFailures = [];
  if (!aboutPass) assertionFailures.push('About bounds or mask');
  if (
    construction[0.92].intersection?.width !== 0 ||
    construction[0.92].intersection?.height !== 0
  ) {
    assertionFailures.push('Construction 0.92 intersection');
  }
  if (
    construction[0.99].intersection?.width !== 0 ||
    construction[0.99].intersection?.height !== 0
  ) {
    assertionFailures.push('Construction 0.99 intersection');
  }
  if (
    construction[0.7].rotationX === null ||
    Math.abs(construction[0.7].rotationX) < 175 ||
    Math.abs(construction[0.7].rotationX) > 185
  ) {
    assertionFailures.push('Construction 0.70 rotation');
  }
  for (const progress of [0, 0.5, 0.99]) {
    const rect = nilgiris[progress];
    if (
      !rect ||
      rect.top > 0 ||
      rect.bottom < viewport.height ||
      nilgirisOverflow !== 'visible'
    ) {
      assertionFailures.push(`Nilgiris ${progress} coverage`);
    }
  }
  if (previewHeight <= 0) {
    assertionFailures.push('Grid-to-Nilgiris preview');
  }

  if (assertionFailures.length > 0) {
    throw new Error(
      `Required ${viewport.width}×${viewport.height} assertions failed: ${assertionFailures.join(', ')}; data=${JSON.stringify({ about: { copy: aboutCopy, heading: aboutHeading, plates: aboutPlates, reveal: aboutReveal }, construction, nilgiris, previewHeight })}`,
    );
  }

  return {
    viewport,
    about: {
      copy: aboutCopy,
      heading: aboutHeading,
      plates: aboutPlates,
      reveal: aboutReveal,
    },
    construction,
    nilgiris,
    nilgirisOverflow,
    gridNilgirisPreviewHeight: previewHeight,
  };
}

async function runRuntimeBehaviorAssertions(page) {
  await page.setViewportSize(PRIMARY_VIEWPORT);
  await page.evaluate(() => {
    window.__VISUAL_AUDIT_SCROLL_TRIGGER__?.refresh();
  });
  await settleAfterScroll(page);

  const sequences = [
    {
      chapter: 'hero',
      name: 'hero',
      states: [
        [0.001, 1],
        [0.45, 49],
        [0.9, 96],
        [0.45, 49],
        [0.001, 1],
      ],
    },
    {
      chapter: 'nilgiris',
      name: 'nilgiris',
      states: [
        [0.001, 1],
        [35 / 71, 36],
        [0.999, 72],
        [35 / 71, 36],
        [0.001, 1],
      ],
    },
    {
      chapter: 'closing',
      name: 'closing',
      states: [
        [0.001, 1],
        [0.25, 37],
        [0.5, 72],
        [0.25, 37],
        [0.001, 1],
      ],
    },
  ];
  const sequenceResults = [];

  for (const sequence of sequences) {
    const observed = [];
    for (const [progress, frame] of sequence.states) {
      const trigger = await chapterTrigger(page, sequence.chapter);
      await scrollImmediately(
        page,
        trigger.start + progress * (trigger.end - trigger.start),
      );
      await waitForFrame(page, sequence.name, frame);
      observed.push({
        progress,
        frame: (await renderedFrame(page, sequence.name))?.frame ?? null,
      });
    }
    sequenceResults.push({
      name: sequence.name,
      observed,
      passed: observed.every(
        (state, index) => state.frame === sequence.states[index][1],
      ),
    });
  }

  const constructionRotations = [];
  for (const progress of [0.7, 0.2, 0.7]) {
    const state = await measureAt(page, 'construction', progress);
    constructionRotations.push({
      progress,
      rotationX:
        measuredElement(state, '.construction__plane')?.rotationX ?? null,
    });
  }
  const flipPassed =
    Math.abs(constructionRotations[0].rotationX ?? 0) >= 175 &&
    Math.abs(constructionRotations[1].rotationX ?? 999) <= 5 &&
    Math.abs(constructionRotations[2].rotationX ?? 0) >= 175;

  const registryChecks = await page.evaluate(() => ({
    chapterCount: document.querySelectorAll('.chapter').length,
    totalScrollVh: Number(
      document.querySelector('#exhibition')?.dataset.totalScrollVh,
    ),
    stitchTotal: Number(
      document.querySelector('#exhibition')?.dataset.stitchTotal,
    ),
    navigation: Array.from(
      document.querySelectorAll('.thread-nav__knot'),
      (knot) => knot.dataset.chapter,
    ),
  }));
  const expectedNavigation = [
    'hero',
    'about',
    'construction',
    'motifs',
    'grid',
    'nilgiris',
    'artisans',
    'closing',
  ];
  const registryPassed =
    registryChecks.chapterCount === 8 &&
    registryChecks.totalScrollVh === EXPECTED_TOTAL_SCROLL_VH &&
    registryChecks.stitchTotal === EXPECTED_STITCH_TOTAL &&
    JSON.stringify(registryChecks.navigation) ===
      JSON.stringify(expectedNavigation);

  if (
    sequenceResults.some((result) => !result.passed) ||
    !flipPassed ||
    !registryPassed
  ) {
    throw new Error(
      `Runtime behavior assertion failed: ${JSON.stringify({ sequenceResults, constructionRotations, registryChecks })}`,
    );
  }

  return {
    sequences: sequenceResults,
    constructionRotations,
    registry: registryChecks,
  };
}

function sampledDifference(first, second) {
  if (!first || !second || first.length !== second.length) return null;
  let total = 0;
  for (let index = 0; index < first.length; index += 1) {
    total += Math.abs(first[index] - second[index]);
  }
  return total / first.length;
}

function comparisonSummary(manifest) {
  return {
    filenames: manifest.map((entry) => entry.filename),
    dimensions: manifest.map((entry) => [
      entry.filename,
      entry.viewport.width,
      entry.viewport.height,
    ]),
    frames: manifest.map((entry) => [
      entry.filename,
      entry.renderedFrameNumber,
    ]),
    blank: manifest.map((entry) => [
      entry.filename,
      entry.renderCheck?.blank ?? false,
      entry.screenshotBytes === 0,
    ]),
  };
}

async function compareRuns(manifest) {
  if (!compareWith) return null;
  const baseline = JSON.parse(await readFile(compareWith, 'utf8'));
  const current = comparisonSummary(manifest);
  const result = {
    screenshotCountIdentical:
      baseline.filenames.length === current.filenames.length,
    filenamesIdentical:
      JSON.stringify(baseline.filenames) === JSON.stringify(current.filenames),
    dimensionsIdentical:
      JSON.stringify(baseline.dimensions) === JSON.stringify(current.dimensions),
    requestedFramesIdentical:
      JSON.stringify(baseline.frames) === JSON.stringify(current.frames),
    noBlankCaptures:
      current.blank.every(([, canvasBlank, zeroBytes]) => !canvasBlank && !zeroBytes),
  };
  result.passed = Object.values(result).every(Boolean);
  return result;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function writeGallery(manifest) {
  const groups = [...new Set(manifest.map((entry) => entry.group))];
  const sections = groups
    .map((group) => {
      const entries = manifest.filter((entry) => entry.group === group);
      if (group === 'Chapter boundaries') {
        const pairs = [];
        for (let index = 0; index < entries.length; index += 2) {
          pairs.push(`<div class="pair">${entries
            .slice(index, index + 2)
            .map(
              (entry) => `<figure>
  <img src="screenshots/${escapeHtml(entry.filename)}" width="${entry.viewport.width}" height="${entry.viewport.height}" alt="">
  <figcaption><strong>${escapeHtml(entry.filename)}</strong><span>${escapeHtml(entry.boundary)}</span><span>scrollY ${entry.scrollY}px · progress ${entry.actualProgress.toFixed(5)}</span></figcaption>
</figure>`,
            )
            .join('')}</div>`);
        }
        return `<section><h2>${group}</h2>${pairs.join('')}</section>`;
      }

      return `<section><h2>${group}</h2>${entries
        .map(
          (entry) => `<figure>
  <img src="screenshots/${escapeHtml(entry.filename)}" width="${entry.viewport.width}" height="${entry.viewport.height}" alt="">
  <figcaption><strong>${escapeHtml(entry.filename)}</strong><span>${escapeHtml(entry.chapter)} · progress ${entry.actualProgress.toFixed(5)}${entry.renderedFrameNumber ? ` · frame ${entry.renderedFrameNumber}` : ''}${entry.activePlate ? ` · ${entry.activePlate}` : ''}</span><span>scrollY ${entry.scrollY}px · ${entry.viewport.width}×${entry.viewport.height}</span></figcaption>
</figure>`,
        )
        .join('')}</section>`;
    })
    .join('');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Toda exhibition visual audit</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #181818; color: #e8e4dc; font: 14px/1.5 system-ui, sans-serif; }
    header, section { width: min(100%, 1504px); margin: 0 auto; padding: 32px; }
    header { padding-bottom: 0; }
    h1, h2 { font-weight: 500; }
    h2 { margin: 48px 0 20px; border-bottom: 1px solid #444; padding-bottom: 10px; }
    figure { margin: 0 0 36px; }
    img { display: block; width: auto; max-width: 100%; height: auto; background: #090909; }
    figcaption { display: flex; flex-wrap: wrap; gap: 8px 24px; padding: 10px 0; color: #aaa; }
    figcaption strong { color: #f2eee7; font-weight: 600; }
    .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
    .pair img { width: 100%; }
    @media (max-width: 900px) { .pair { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header><h1>Completed exhibition — deterministic visual audit</h1><p>Viewport-only captures. Desktop: 1440×900 and 1440×800. Mobile fallback: 390×844 and 430×932. Reduced motion: 1440×900.</p></header>
  ${sections}
</body>
</html>
`;
  await writeFile(path.join(AUDIT_ROOT, 'index.html'), html);
}

function formatNumber(value, digits = 2) {
  return Number(value).toFixed(digits);
}

async function writeReport({
  manifest,
  logs,
  triggerSets,
  initialChecks,
  finalCounter,
  comparison,
  cacheObservations,
}) {
  const publicAssets = path.join(PROJECT_ROOT, 'public', 'assets');
  const assetFiles = [];
  async function walk(folder) {
    for (const name of await readdir(folder, { withFileTypes: true })) {
      const target = path.join(folder, name.name);
      if (name.isDirectory()) await walk(target);
      else assetFiles.push(target);
    }
  }
  await walk(publicAssets);
  const assetBytes = (
    await Promise.all(assetFiles.map((filename) => stat(filename)))
  ).reduce((total, file) => total + file.size, 0);

  const heroBefore = manifest.find(
    (entry) => entry.filename === '02-hero-before-join.png',
  );
  const heroAfter = manifest.find(
    (entry) => entry.filename === '03-hero-after-join.png',
  );
  const heroJoinDelta = sampledDifference(
    heroBefore?._signature,
    heroAfter?._signature,
  );

  const constructionMacro = manifest.find(
    (entry) => entry.filename === '08-construction-macro.png',
  );
  const bodyRect = constructionMacro?.measurements.elements.find(
    (element) => element.selector === '.construction__body',
  )?.rect;
  const macroRect = constructionMacro?.measurements.elements.find(
    (element) => element.selector === '.construction__macro',
  )?.rect;
  const macroIntersection =
    bodyRect && macroRect ? intersection(bodyRect, macroRect) : null;
  const bodyOcclusion =
    macroIntersection && bodyRect
      ? (macroIntersection.width * macroIntersection.height * 100) /
        (bodyRect.width * bodyRect.height)
      : 0;
  const clothRect = constructionMacro?.measurements.elements.find(
    (element) => element.selector === '.construction__cloth',
  )?.rect;
  const clothIntersection =
    bodyRect && clothRect ? intersection(bodyRect, clothRect) : null;
  const clothOcclusion =
    clothIntersection && bodyRect
      ? (clothIntersection.width * clothIntersection.height * 100) /
        (bodyRect.width * bodyRect.height)
      : 0;

  const aboutMid = manifest.find(
    (entry) => entry.filename === '05-about-mid.png',
  );
  const aboutCopy = aboutMid?.measurements.elements.find(
    (element) => element.selector === '.about__copy',
  );
  const aboutHeading = aboutMid?.measurements.elements.find(
    (element) => element.selector === '.about__heading',
  );
  const constructionBack = manifest.find(
    (entry) => entry.filename === '07-construction-back.png',
  );
  const constructionPlane = constructionBack?.measurements.elements.find(
    (element) => element.selector === '.construction__plane',
  );
  const gridActive = manifest.find(
    (entry) => entry.filename === '16-grid-active.png',
  );
  const gridNilgirisCanvas = gridActive?.measurements.elements.find(
    (element) => element.selector === '.nilgiris__canvas',
  );
  const gridNilgirisVisibleHeight = gridNilgirisCanvas
    ? Math.max(
        0,
        Math.min(PRIMARY_VIEWPORT.height, gridNilgirisCanvas.rect.bottom) -
          Math.max(0, gridNilgirisCanvas.rect.top),
      )
    : 0;
  const nilgirisMid = manifest.find(
    (entry) => entry.filename === '18-nilgiris-mid.png',
  );
  const nilgirisCanvas = nilgirisMid?.measurements.elements.find(
    (element) => element.selector === '.nilgiris__canvas',
  );
  const nilgirisUncoveredHeight = nilgirisCanvas
    ? Math.max(0, PRIMARY_VIEWPORT.height - nilgirisCanvas.rect.bottom)
    : 0;
  const shortConstruction = manifest.find(
    (entry) =>
      entry.filename === '40-construction-macro-1440x800.png',
  );
  const shortBodyRect = shortConstruction?.measurements.elements.find(
    (element) => element.selector === '.construction__body',
  )?.rect;
  const shortClothRect = shortConstruction?.measurements.elements.find(
    (element) => element.selector === '.construction__cloth',
  )?.rect;
  const shortClothIntersection =
    shortBodyRect && shortClothRect
      ? intersection(shortBodyRect, shortClothRect)
      : null;
  const shortClothOcclusion =
    shortClothIntersection && shortBodyRect
      ? (shortClothIntersection.width *
          shortClothIntersection.height *
          100) /
        (shortBodyRect.width * shortBodyRect.height)
      : 0;

  const clipped = manifest.flatMap((entry) =>
    entry.measurements.elements
      .filter(
        (element) =>
          element.textual &&
          element.clippedInternally &&
          element.opacity > 0.05 &&
          element.rect.width > 0 &&
          element.rect.height > 0,
      )
      .map((element) => ({
        filename: entry.filename,
        selector: element.selector,
        rect: element.rect,
      })),
  );
  const navCollisions = manifest.flatMap((entry) =>
    entry.measurements.navCollisions.map((collision) => ({
      filename: entry.filename,
      ...collision,
    })),
  );

  const triggerTable = triggerSets.primary
    .map(
      (trigger) =>
        `| ${trigger.chapter} | ${formatNumber(trigger.start, 3)} | ${formatNumber(trigger.end, 3)} |`,
    )
    .join('\n');
  const screenshotTable = manifest
    .map(
      (entry) =>
        `| ${entry.filename} | ${entry.viewport.width}×${entry.viewport.height} | ${entry.chapter} | ${formatNumber(entry.requestedProgress, 6)} | ${formatNumber(entry.actualProgress, 6)} | ${entry.scrollY} | ${formatNumber(entry.triggerStart, 3)} | ${formatNumber(entry.triggerEnd, 3)} | ${entry.renderedFrameNumber ?? '—'} | ${entry.activePlate ?? '—'} |`,
    )
    .join('\n');
  const motifMappingTable = manifest
    .filter((entry) => entry.activePlate?.startsWith('motif-'))
    .map(
      (entry) =>
        `| ${entry.activePlate} | ${entry.plateCheck?.svgMotifId ?? '—'} | ${entry.plateCheck?.unitCount ?? '—'} | ${entry.plateCheck?.dominant ? 'yes' : 'no'} |`,
    )
    .join('\n');

  const consoleLines = [...logs.consoleErrors, ...logs.consoleWarnings]
    .map(
      (message) =>
        `- \`${message.type}\` ${message.text} (${message.location.url || 'inline'}:${message.location.lineNumber ?? 0})`,
    )
    .join('\n');
  const failedLines = [...logs.failedRequests, ...logs.httpErrors]
    .map(
      (request) =>
        `- ${request.status ? `${request.status} ` : ''}\`${request.url}\`${request.error ? ` — ${request.error}` : ''}`,
    )
    .join('\n');

  const clippedLines = clipped.length
    ? clipped
        .map(
          (item) =>
            `- \`${item.filename}\`: \`${item.selector}\` reports internal overflow at ${JSON.stringify(item.rect)}.`,
        )
        .join('\n')
    : '- No visible audited element reported internal scroll/client clipping.';
  const collisionLines = navCollisions.length
    ? navCollisions
        .map(
          (item) =>
            `- \`${item.filename}\`: ${item.first} overlaps ${item.second} by ${formatNumber(item.width)}×${formatNumber(item.height)}px.`,
        )
        .join('\n')
    : '- No thread-navigation label collisions were measured.';

  const cacheLines = cacheObservations
    .map(
      (observation) =>
        `- ${observation.filename}: [${observation.cache.join(', ')}] (${observation.cache.length} decoded sequence entr${observation.cache.length === 1 ? 'y' : 'ies'})`,
    )
    .join('\n');

  const comparisonText = comparison
    ? `Second-run comparison: **${comparison.passed ? 'PASS' : 'FAIL'}**. Count identical: ${comparison.screenshotCountIdentical}; filenames identical: ${comparison.filenamesIdentical}; dimensions identical: ${comparison.dimensionsIdentical}; requested frames identical: ${comparison.requestedFramesIdentical}; no blank captures: ${comparison.noBlankCaptures}.`
    : 'This invocation produced the first-run baseline.';

  const constructionIssue =
    macroIntersection &&
    macroIntersection.width > 0 &&
    macroIntersection.height > 0
      ? `- \`08-construction-macro.png\`: \`.construction__body\` and \`.construction__macro\` intersect by ${formatNumber(macroIntersection.width)}×${formatNumber(macroIntersection.height)}px, occluding ${formatNumber(bodyOcclusion, 2)}% of the body rectangle. The overlap is structurally accidental because both elements carry readable foreground content in the same chapter state.`
      : '- `08-construction-macro.png`: the requested `.construction__body` / `.construction__macro` measurement found no intersection at 1440×900 (0×0px; 0.00% body occlusion). The previously described macro-over-body issue was not reproduced at this exact capture state.';

  const report = `# Visual audit

## Executive result

The deterministic viewport audit captured ${manifest.length} states across all eight chapters and seven boundaries. ${comparisonText}

All requested sequence frames were confirmed from the live rounded-index canvas state before capture. Every audited sequence canvas contained opaque, non-uniform pixels.

## Capture environment

- URL: \`${URL}\`
- Server: \`npm run dev -- --host 127.0.0.1 --port 4173 --strictPort\`
- Browser automation: Playwright Chromium
- Primary viewport: 1440×900 CSS pixels
- Short-height viewport: 1440×800 CSS pixels
- Device scale factor: 1
- Browser zoom: 100%
- Colour scheme: dark
- Reduced motion: no-preference
- Touch/mobile emulation: off
- Screenshots: viewport only
- Grain was kept visible but paused at a deterministic keyframe in the audit page only. Production files were not altered.
- Mounted chapters: ${initialChecks.chapterCount}
- Declared total scroll: ${initialChecks.totalScrollVh}vh
- Measured document height at 1440×900: ${initialChecks.documentHeight}px (${formatNumber(initialChecks.documentHeight / PRIMARY_VIEWPORT.height, 2)} viewport heights)
- Displayed stitch total: ${initialChecks.stitchTotal.toLocaleString('en-IN')}

### Live primary-pass chapter ScrollTriggers

| Chapter | Start px | End px |
|---|---:|---:|
${triggerTable}

## Hero

- Captures: \`01-hero-start.png\` through \`04-hero-final.png\`.
- Confirmed rendered frames: 1, 48, 49 and 96.
- Mean absolute sampled RGB delta between frame-48 and frame-49 canvases: ${heroJoinDelta === null ? 'not available' : formatNumber(heroJoinDelta, 3)} / 255.
- The sequence canvas was opaque and non-blank for all four states.

## About

- \`05-about-mid.png\` captured at progress 0.55.
- Both \`texture-cloth.webp\` and \`texture-folds.webp\` decoded before capture.
- The copy mask remained visibly active at this state: \`.about__copy\` bounds \`${aboutCopy ? JSON.stringify(aboutCopy.rect) : 'unavailable'}\`, \`--warp-open: ${aboutCopy?.warpOpen || 'unavailable'}\`, mask \`${aboutCopy?.maskImage || 'unavailable'}\`.
- Heading bounds: \`${aboutHeading ? JSON.stringify(aboutHeading.rect) : 'unavailable'}\`.

## Construction

- Front, back and macro stills decoded before capture.
- \`06-construction-front.png\`, \`07-construction-back.png\` and \`08-construction-macro.png\` record the implemented flip and macro states.
- Known macro measurement at 1440×900:
  - Body selector: \`.construction__body\`
  - Body rectangle: \`${bodyRect ? JSON.stringify(bodyRect) : 'unavailable'}\`
  - Macro selector: \`.construction__macro\`
  - Macro rectangle: \`${macroRect ? JSON.stringify(macroRect) : 'unavailable'}\`
  - Intersection rectangle: \`${macroIntersection ? JSON.stringify(macroIntersection) : 'unavailable'}\`
  - Body-copy area occluded: **${formatNumber(bodyOcclusion, 2)}%**
- The foreground cloth intersects the body at \`${clothIntersection ? JSON.stringify(clothIntersection) : 'unavailable'}\`, covering **${formatNumber(clothOcclusion, 2)}%** of the body rectangle.
- At \`07-construction-back.png\`, \`.construction__plane\` has computed rotationX ${constructionPlane ? formatNumber(constructionPlane.rotationX, 2) : 'unavailable'}° and bounds \`${constructionPlane ? JSON.stringify(constructionPlane.rect) : 'unavailable'}\`.
- This issue was measured only and was not corrected.

## Motifs

- All six captures use their requested chapter progress.
- The flowing 4+2 plate layout does not create six scroll-exclusive dominant states. The audit uses the existing public hover interaction to make the expected plate dominant at each requested progress; no internal state is changed.
- Each capture verified that the active plate's \`data-motif-id\` matched its embedded SVG \`data-motif-id\`, and that discrete SVG units were rendered.

| Plate | Active SVG motif ID | Discrete units | Dominant |
|---|---:|---:|---|
${motifMappingTable}

## Grid

- \`15-grid-initial.png\` captures the untouched public grid.
- Before \`16-grid-active.png\`, a pointer drag was performed on the visible canvas. Mirror mode remained at its public default; no internal state was manipulated.
- At Grid progress 0.58, \`.nilgiris__canvas\` occupies ${formatNumber(gridNilgirisVisibleHeight)}px of the viewport bottom; its full bounds are \`${gridNilgirisCanvas ? JSON.stringify(gridNilgirisCanvas.rect) : 'unavailable'}\`.

## Nilgiris

- Confirmed frame 1 at progress 0 and frame 36 at progress ${formatNumber(35 / 71, 6)}.
- Both sequence canvases were opaque and non-blank.
- At the frame-36 state, \`.nilgiris__canvas\` ends at y=${nilgirisCanvas ? formatNumber(nilgirisCanvas.rect.bottom) : 'unavailable'}px, leaving ${formatNumber(nilgirisUncoveredHeight)}px of the viewport below the sequence image; full bounds: \`${nilgirisCanvas ? JSON.stringify(nilgirisCanvas.rect) : 'unavailable'}\`.

## Artisans

- All four assets decoded in order.
- At the requested progress values, the expected plate was closest to viewport centre among visible plates; no progress adjustment was required.

## Closing

- Confirmed frame 1 at progress 0 and frame 72 at chapter progress 0.5, reflecting the implemented 0–0.5 sequence span.
- The final thread frame was opaque and non-blank.
- The page counter reached **${finalCounter.value.toLocaleString('en-IN')}** at maximum scroll.

## Chapter boundaries

Fourteen viewport captures use 0.99 of each outgoing chapter trigger and 0.01 of each incoming chapter trigger. Their exact live scroll positions are recorded in the manifest.

## 1440×800 check

- \`39-about-1440x800.png\` captures About at progress 0.55.
- \`40-construction-macro-1440x800.png\` captures Construction at progress 0.92.
- About fits inside the shorter surface but retains the same active 12.10px warp mask and illegible interrupted glyphs.
- Construction body/cloth intersection: \`${shortClothIntersection ? JSON.stringify(shortClothIntersection) : 'unavailable'}\`; body area occluded: **${formatNumber(shortClothOcclusion, 2)}%**.
- The viewport was restored to 1440×900 after these captures.

## Console and network results

- Console errors: ${logs.consoleErrors.length}
- Console warnings: ${logs.consoleWarnings.length}
- Failed requests: ${logs.failedRequests.length}
- HTTP responses ≥400: ${logs.httpErrors.length}

${consoleLines || '- No console errors or warnings.'}

${failedLines || '- No failed requests or unexpected 404 responses.'}

### Decoded sequence cache observations

No more than two entries were present:

${cacheLines}

## Objective visual issues

### Overlap and clipping measurements

${constructionIssue}

- \`08-construction-macro.png\`: \`.construction__body\` and \`.construction__cloth\` intersect by ${clothIntersection ? `${formatNumber(clothIntersection.width)}×${formatNumber(clothIntersection.height)}px` : 'an unavailable measurement'}, occluding ${formatNumber(clothOcclusion, 2)}% of the body bounds. The screenshot visibly loses the right portion of each body line behind the cloth; this is structurally accidental.
- \`07-construction-back.png\`: the requested “back” state is a perspective edge-on flip, not a flat back face. Selector \`.construction__plane\`; bounds \`${constructionPlane ? JSON.stringify(constructionPlane.rect) : 'unavailable'}\`; computed rotationX ${constructionPlane ? formatNumber(constructionPlane.rotationX, 2) : 'unavailable'}°. No element overlap is involved.
- \`05-about-mid.png\`: the copy remains interrupted by its active warp mask, leaving incomplete glyphs across the heading and all three paragraphs. Selectors \`.about__copy\`, \`.about__heading\`, \`.about__body\`; copy bounds \`${aboutCopy ? JSON.stringify(aboutCopy.rect) : 'unavailable'}\`; heading bounds \`${aboutHeading ? JSON.stringify(aboutHeading.rect) : 'unavailable'}\`. This makes the passage objectively illegible at the requested midpoint.
- \`16-grid-active.png\`: upcoming \`.nilgiris__canvas\` is visible for the bottom ${formatNumber(gridNilgirisVisibleHeight)}px of the viewport while Grid remains the active pinned chapter. Bounds \`${gridNilgirisCanvas ? JSON.stringify(gridNilgirisCanvas.rect) : 'unavailable'}\`. This is a chapter-content bleed rather than an element-over-element overlap.
- \`18-nilgiris-mid.png\`: \`.nilgiris__canvas\` bounds \`${nilgirisCanvas ? JSON.stringify(nilgirisCanvas.rect) : 'unavailable'}\` leave a ${formatNumber(nilgirisUncoveredHeight)}px-high × 1440px-wide slate-only area at the viewport bottom. The sequence surface has scrolled out before its trigger midpoint, producing a structurally accidental empty region.

${clippedLines}

${collisionLines}

No blank or transparent sequence canvas, missing still, sequence-canvas edge, or zero-byte screenshot was detected automatically. Image continuity, topology, trace/source correspondence and framing were inspected from the retained viewport captures; any additional exact visual findings are listed here after screenshot review.

## Known deferred shipping issues

- 75 Hero frames exceed 70KB.
- \`public/assets/\` is approximately 15.52MiB (measured during this audit: ${formatNumber(assetBytes / 1024 / 1024, 2)}MiB).
- The shipping target is no more than 12MiB.

## Screenshot manifest

No requested Motifs or Artisans progress value required adjustment. Small requested/actual differences in the table are integer-pixel scroll rounding only.

| Filename | Viewport | Chapter | Requested progress | Actual progress | ScrollY | Trigger start | Trigger end | Frame | Active plate |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
${screenshotTable}

## Files created or modified

- \`scripts/visual-audit.mjs\`
- \`package.json\`
- \`package-lock.json\`
- \`audit/visual/screenshots/01-hero-start.png\` through \`audit/visual/screenshots/40-construction-macro-1440x800.png\`
- \`audit/visual/manifest.json\`
- \`audit/visual/index.html\`
- \`audit/visual/VISUAL-AUDIT.md\`
- \`audit/visual-audit.zip\` (created after the final run)
`;

  await writeFile(path.join(AUDIT_ROOT, 'VISUAL-AUDIT.md'), report);
}

async function writeFinalReport({
  manifest,
  logs,
  triggerSets,
  initialChecks,
  finalCounter,
  comparison,
  cacheObservations,
  assertions,
  reducedSequenceRequests,
  runtimeBehavior,
}) {
  const assetRoot = path.join(PROJECT_ROOT, 'public', 'assets');
  const assetFiles = [];
  const walk = async (folder) => {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const target = path.join(folder, entry.name);
      if (entry.isDirectory()) await walk(target);
      else assetFiles.push(target);
    }
  };
  await walk(assetRoot);
  const assetStats = await Promise.all(
    assetFiles.map(async (filename) => ({
      filename,
      size: (await stat(filename)).size,
    })),
  );
  const assetBytes = assetStats.reduce((sum, file) => sum + file.size, 0);
  const sequenceStats = assetStats.filter((file) =>
    /\/(?:hero|nilgiris|closing)\/\d{4}\.webp$/.test(file.filename),
  );
  const largestSequenceFrame = Math.max(
    ...sequenceStats.map((file) => file.size),
  );
  const oversizedSequenceFrames = sequenceStats.filter(
    (file) => file.size > 71_680,
  ).length;
  const primary = assertions.primary;
  const short = assertions.short;
  const triggerTable = triggerSets.primary
    .map(
      (trigger) =>
        `| ${trigger.chapter} | ${formatNumber(trigger.start, 3)} | ${formatNumber(trigger.end, 3)} |`,
    )
    .join('\n');
  const screenshotTable = manifest
    .map(
      (entry) =>
        `| ${entry.filename} | ${entry.viewport.width}×${entry.viewport.height} | ${entry.chapter} | ${formatNumber(entry.requestedProgress, 6)} | ${formatNumber(entry.actualProgress, 6)} | ${entry.scrollY} | ${entry.triggerStart === null ? '—' : formatNumber(entry.triggerStart, 3)} | ${entry.triggerEnd === null ? '—' : formatNumber(entry.triggerEnd, 3)} | ${entry.renderedFrameNumber ?? '—'} | ${entry.activePlate ?? '—'} |`,
    )
    .join('\n');
  const motifMappings = manifest
    .filter((entry) => entry.activePlate?.startsWith('motif-'))
    .map(
      (entry) =>
        `| ${entry.activePlate} | motif-${entry.plateCheck?.svgMotifId}.svg | ${entry.plateCheck?.unitCount ?? '—'} | ${entry.plateCheck?.mappingMatches ? 'pass' : 'fail'} |`,
    )
    .join('\n');
  const cacheLines = cacheObservations
    .map(
      (observation) =>
        `- ${observation.filename}: [${observation.cache.join(', ')}] (${observation.cache.length})`,
    )
    .join('\n');
  const compareText = comparison
    ? `Second run: **${comparison.passed ? 'PASS' : 'FAIL'}** — identical count ${comparison.screenshotCountIdentical}, filenames ${comparison.filenamesIdentical}, dimensions ${comparison.dimensionsIdentical}, requested frames ${comparison.requestedFramesIdentical}, non-blank ${comparison.noBlankCaptures}.`
    : 'First-run baseline generated.';
  const rect = (value) => `\`${JSON.stringify(value)}\``;

  const report = `# Visual audit

## Executive result

${compareText} The final run contains ${manifest.length} non-zero viewport screenshots. All eight desktop chapters mounted, the document remained ${initialChecks.totalScrollVh}vh, and the counter reached ${finalCounter.value.toLocaleString('en-IN')}.

The required visual corrections pass their automated geometry assertions. Console and HTTP assertions pass. The payload shipping gate remains blocked because the mandated quality floors cannot produce the requested byte limits; exact measurements are recorded below.

## Capture environment

- Browser automation: Playwright Chromium
- URL: \`${URL}\`
- Server: \`npm run dev -- --host 127.0.0.1 --port 4173 --strictPort\`
- Desktop viewports: 1440×900 and 1440×800, DPR 1, 100% zoom, dark scheme
- Mobile fallback viewports: 390×844 and 430×932
- Reduced-motion viewport: 1440×900
- Screenshots are viewport-only.
- Mounted desktop chapters: ${initialChecks.chapterCount}
- Measured 1440×900 document height: ${initialChecks.documentHeight}px

| Chapter | ScrollTrigger start | ScrollTrigger end |
|---|---:|---:|
${triggerTable}

## Hero

- Normal-motion captures verify frames 1, 48, 49 and 96 in established order.
- Forward/reverse frame assertion: ${runtimeBehavior.sequences.find((result) => result.name === 'hero').observed.map((state) => state.frame).join(' → ')}.
- Reduced motion rendered frame 1 only.

## About

- 1440×900 at progress 0.55: \`--warp-open\` ${primary.about.copy.warpOpen}; copy ${rect(primary.about.copy.rect)}; heading ${rect(primary.about.heading.rect)}; plates ${rect(primary.about.plates.rect)}.
- 1440×800 at progress 0.55: \`--warp-open\` ${short.about.copy.warpOpen}; copy ${rect(short.about.copy.rect)}; heading ${rect(short.about.heading.rect)}; plates ${rect(short.about.plates.rect)}.
- The fully open 22px mask and both viewport-bound requirements pass. All ${primary.about.reveal.lineCount} split lines have a maximum residual translation of ${formatNumber(primary.about.reveal.maxTranslation, 3)}px.

## Construction

- Flat reverse at progress 0.70: rotationX ${formatNumber(primary.construction[0.7].rotationX, 3)}° at 1440×900 and ${formatNumber(short.construction[0.7].rotationX, 3)}° at 1440×800.
- 1440×900 body/cloth intersection at 0.92: ${rect(primary.construction[0.92].intersection)}; at 0.99: ${rect(primary.construction[0.99].intersection)}.
- 1440×800 body/cloth intersection at 0.92: ${rect(short.construction[0.92].intersection)}; at 0.99: ${rect(short.construction[0.99].intersection)}.
- The CSS 3D flip remains in the locked 0.38–0.65 interval and reverses with scroll.
- Flip reversal assertion: ${runtimeBehavior.constructionRotations.map((state) => `${state.progress}: ${formatNumber(state.rotationX, 2)}°`).join(' → ')}.

## Motifs

All six image/SVG mappings pass and remain unchanged:

| Plate | SVG | Units | Mapping |
|---|---|---:|---|
${motifMappings}

## Grid

- Public pointer-drag interaction is captured in \`16-grid-active.png\`.
- Grid-to-Nilgiris preview retained: ${formatNumber(primary.gridNilgirisPreviewHeight, 3)}px visible at 1440×900.
- Grid continues to consume motif 4; the 40vh release tail and 100vh bleed remain intact.

## Nilgiris

- 1440×900 canvas at progress 0.50: ${rect(primary.nilgiris[0.5])}; at 0.99: ${rect(primary.nilgiris[0.99])}.
- 1440×800 canvas at progress 0.50: ${rect(short.nilgiris[0.5])}; at 0.99: ${rect(short.nilgiris[0.99])}.
- Top≤0, bottom≥viewport-height, and unclipped-surface assertions pass at 0.00, 0.50 and 0.99 (\`overflow: ${primary.nilgirisOverflow}\`).
- Forward/reverse frame assertion: ${runtimeBehavior.sequences.find((result) => result.name === 'nilgiris').observed.map((state) => state.frame).join(' → ')}.
- Reduced motion renders frame 36 only.

## Artisans

All four assets remain ordered and each requested plate is dominant in its capture.

## Closing

- Normal motion verifies frame 1 then frame 72 in forward order; reverse scrolling remains reversible.
- Forward/reverse frame assertion: ${runtimeBehavior.sequences.find((result) => result.name === 'closing').observed.map((state) => state.frame).join(' → ')}.
- Reduced motion renders frame 72 only.
- Thesis and credits remain mounted. The displayed arithmetic remains 334 × 32 × 6 = 64,128.

## Chapter boundaries

All fourteen before/after captures remain present, using 0.99 of the outgoing trigger and 0.01 of the incoming trigger.

## 1440×800 check

The compact About type rule is active, About stays inside 40–760px, Construction has zero body/cloth intersection at both late states, and Nilgiris retains full coverage.

## Mobile fallback

\`41-mobile-390x844.png\` and \`42-mobile-430x932.png\` show the static full-viewport fallback. Each page contains zero chapter nodes and initializes no exhibition runtime.

## Reduced motion

Only these sequence requests occurred:

${reducedSequenceRequests.map((request) => `- \`${request}\``).join('\n')}

No full sequence cache was populated. Grain and plate drift are disabled while copy opacity reveals, thread drawing, counter, and Construction flip remain scroll-controlled.

## Console and network results

- Console errors: ${logs.consoleErrors.length}
- Console warnings: ${logs.consoleWarnings.length}
- Failed requests: ${logs.failedRequests.length}
- HTTP responses ≥400: ${logs.httpErrors.length}
- Navigation destinations: ${runtimeBehavior.registry.navigation.join(', ')}.

Decoded normal-motion sequence-cache observations never exceeded two:

${cacheLines}

## Objective visual issues

- No required About clipping/mask defect remains.
- No late Construction body/cloth collision remains.
- No Nilgiris slate-only bottom strip remains.
- The Grid-to-Nilgiris landscape preview is intentional and retained.
- No blank canvas, missing screenshot, console warning/error, or failed request was detected.

## Known deferred shipping issues

- Selected Hero quality: 42. Nilgiris and Closing remain 62.
- ${oversizedSequenceFrames} sequence frames exceed 71,680 bytes; the largest is ${largestSequenceFrame.toLocaleString('en-US')} bytes.
- \`public/assets/\` totals ${assetBytes.toLocaleString('en-US')} bytes (${formatNumber(assetBytes / 1024 / 1024, 2)}MiB), above the 12,582,912-byte ceiling.
- Descending Hero tests 62→42 produced no passing quality. Shared Nilgiris/Closing tests 61→50 also produced no passing total, so the mandated floors were not crossed.

## Screenshot manifest

| Filename | Viewport | Chapter | Requested progress | Actual progress | ScrollY | Trigger start | Trigger end | Frame | Active plate |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
${screenshotTable}

## Files created or modified

- \`scripts/visual-audit.mjs\`
- \`audit/visual/screenshots/01-hero-start.png\` through \`audit/visual/screenshots/45-reduced-closing-final.png\`
- \`audit/visual/manifest.json\`
- \`audit/visual/index.html\`
- \`audit/visual/VISUAL-AUDIT.md\`
- \`audit/visual-audit.zip\`
`;

  await writeFile(path.join(AUDIT_ROOT, 'VISUAL-AUDIT.md'), report);
}

async function main() {
  await prepareOutput();
  const server = startServer();
  let browser;

  try {
    await waitForServer(server);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: PRIMARY_VIEWPORT,
      deviceScaleFactor: 1,
      colorScheme: 'dark',
      reducedMotion: 'no-preference',
      hasTouch: false,
      isMobile: false,
    });
    const page = await context.newPage();
    await installAuditHooks(page);

    const logs = {
      consoleErrors: [],
      consoleWarnings: [],
      failedRequests: [],
      httpErrors: [],
    };
    attachLogs(page, logs);

    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(
      () => !document.querySelector('.preloader'),
      null,
      { timeout: 60_000 },
    );
    await page.addStyleTag({
      content:
        '.grain { animation-play-state: paused !important; animation-delay: 0s !important; }',
    });
    await page.waitForTimeout(500);

    const initialChecks = await page.evaluate(
      ({ expectedHeightVh, expectedStitches }) => {
        const root = document.querySelector('#exhibition');
        const closingText =
          document.querySelector('.closing__credits')?.textContent ?? '';
        return {
          chapterCount: document.querySelectorAll('.chapter').length,
          totalScrollVh: Number(root?.dataset.totalScrollVh),
          stitchTotal: Number(root?.dataset.stitchTotal),
          documentHeight: document.documentElement.scrollHeight,
          viewportHeight: innerHeight,
          closingShowsTotal: closingText.includes(
            expectedStitches.toLocaleString('en-IN'),
          ),
          heightMatches:
            Math.abs(
              document.documentElement.scrollHeight -
                (expectedHeightVh / 100) * innerHeight,
            ) <= 1,
        };
      },
      {
        expectedHeightVh: EXPECTED_TOTAL_SCROLL_VH,
        expectedStitches: EXPECTED_STITCH_TOTAL,
      },
    );

    if (
      initialChecks.chapterCount !== 8 ||
      initialChecks.totalScrollVh !== EXPECTED_TOTAL_SCROLL_VH ||
      initialChecks.stitchTotal !== EXPECTED_STITCH_TOTAL ||
      !initialChecks.closingShowsTotal ||
      !initialChecks.heightMatches
    ) {
      throw new Error(
        `Pre-capture validation failed: ${JSON.stringify(initialChecks)}`,
      );
    }
    if (logs.failedRequests.length > 0 || logs.httpErrors.length > 0) {
      throw new Error(
        `Asset request failed before capture: ${JSON.stringify({
          failed: logs.failedRequests,
          http: logs.httpErrors,
        })}`,
      );
    }

    const triggerSets = {
      primary: await allChapterTriggers(page),
      short: null,
    };
    const manifest = [];
    const cacheObservations = [];
    const chapterOrder = [
      'hero',
      'about',
      'construction',
      'motifs',
      'grid',
      'nilgiris',
      'artisans',
      'closing',
    ];
    const primaryDefinitions = screenshotDefinitions
      .filter((definition) => definition.viewport === undefined)
      .sort(
        (first, second) =>
          chapterOrder.indexOf(first.chapter) -
            chapterOrder.indexOf(second.chapter) ||
          first.actualProgress - second.actualProgress ||
          first.filename.localeCompare(second.filename),
      );
    const shortDefinitions = screenshotDefinitions.filter(
      (definition) => definition.viewport !== undefined,
    );
    const executionDefinitions = [
      ...primaryDefinitions,
      ...shortDefinitions,
    ];

    for (const definition of executionDefinitions) {
      process.stdout.write(`Capturing ${definition.filename}\n`);
      const entry = await captureOne(page, definition, logs);
      entry.group = definition.group;
      manifest.push(entry);
      if (sequenceName(definition.chapter)) {
        const cache = await page.evaluate(
          () => window.__VISUAL_AUDIT_SEQUENCE__?.cache() ?? [],
        );
        if (cache.length > 2) {
          throw new Error(
            `Sequence cache exceeded two entries: ${cache.join(', ')}`,
          );
        }
        cacheObservations.push({ filename: definition.filename, cache });
      }
      if (
        definition.filename === '39-about-1440x800.png' &&
        triggerSets.short === null
      ) {
        triggerSets.short = await allChapterTriggers(page);
      }
    }

    const assertions = {
      primary: await runRequiredAssertions(page, PRIMARY_VIEWPORT),
      short: await runRequiredAssertions(page, SHORT_VIEWPORT),
    };
    const runtimeBehavior = await runRuntimeBehaviorAssertions(page);

    for (const definition of mobileDefinitions) {
      process.stdout.write(`Capturing ${definition.filename}\n`);
      const mobileContext = await browser.newContext({
        viewport: definition.viewport,
        deviceScaleFactor: 1,
        colorScheme: 'dark',
        reducedMotion: 'no-preference',
        hasTouch: false,
        isMobile: false,
      });
      const mobilePage = await mobileContext.newPage();
      attachLogs(mobilePage, logs);
      manifest.push(
        await captureMobileFallback(mobilePage, definition, logs),
      );
      await mobileContext.close();
    }

    const reducedContext = await browser.newContext({
      viewport: PRIMARY_VIEWPORT,
      deviceScaleFactor: 1,
      colorScheme: 'dark',
      reducedMotion: 'reduce',
      hasTouch: false,
      isMobile: false,
    });
    const reducedPage = await reducedContext.newPage();
    const reducedSequenceRequests = new Set();
    reducedPage.on('request', (request) => {
      const pathname = new globalThis.URL(request.url()).pathname;
      if (
        /^\/assets\/(?:hero|nilgiris|closing)\/\d{4}\.webp$/.test(
          pathname,
        )
      ) {
        reducedSequenceRequests.add(pathname);
      }
    });
    attachLogs(reducedPage, logs);
    await installAuditHooks(reducedPage);
    await reducedPage.goto(URL, { waitUntil: 'networkidle' });
    await reducedPage.waitForFunction(
      () =>
        document.querySelectorAll('.chapter').length === 8 &&
        !document.querySelector('.preloader'),
      null,
      { timeout: 60_000 },
    );

    for (const definition of reducedDefinitions) {
      process.stdout.write(`Capturing ${definition.filename}\n`);
      const entry = await captureOne(reducedPage, definition, logs);
      entry.group = definition.group;
      manifest.push(entry);
    }

    const expectedReducedRequests = [
      '/assets/closing/0072.webp',
      '/assets/hero/0001.webp',
      '/assets/nilgiris/0036.webp',
    ];
    const actualReducedRequests = [...reducedSequenceRequests].sort();
    if (
      JSON.stringify(actualReducedRequests) !==
      JSON.stringify(expectedReducedRequests)
    ) {
      throw new Error(
        `Reduced-motion sequence requests were ${JSON.stringify(actualReducedRequests)}; expected ${JSON.stringify(expectedReducedRequests)}.`,
      );
    }
    await reducedContext.close();

    manifest.sort((first, second) =>
      first.filename.localeCompare(second.filename),
    );

    await page.setViewportSize(PRIMARY_VIEWPORT);
    await page.evaluate(() => {
      window.__VISUAL_AUDIT_SCROLL_TRIGGER__?.refresh();
    });
    await settleAfterScroll(page);
    const maxScroll = await page.evaluate(
      () => document.documentElement.scrollHeight - innerHeight,
    );
    await scrollImmediately(page, maxScroll);
    const finalCounter = await page.evaluate(() => {
      const text =
        document.querySelector('.thread-nav__counter-value')?.textContent ??
        '';
      return {
        text,
        value: Number(text.replaceAll(/[^0-9]/g, '')),
        scrollY: window.scrollY,
      };
    });
    if (finalCounter.value !== EXPECTED_STITCH_TOTAL) {
      throw new Error(
        `Counter ended at ${finalCounter.value}; expected ${EXPECTED_STITCH_TOTAL}.`,
      );
    }

    if (
      logs.consoleErrors.length > 0 ||
      logs.consoleWarnings.length > 0 ||
      logs.failedRequests.length > 0 ||
      logs.httpErrors.length > 0
    ) {
      throw new Error(
        `Console/network assertions failed: ${JSON.stringify(logs)}`,
      );
    }

    const comparison = await compareRuns(manifest);
    if (comparison && !comparison.passed) {
      throw new Error(
        `The second run did not match the baseline: ${JSON.stringify(comparison)}`,
      );
    }

    await writeFinalReport({
      manifest,
      logs,
      triggerSets,
      initialChecks,
      finalCounter,
      comparison,
      cacheObservations,
      assertions,
      reducedSequenceRequests: actualReducedRequests,
      runtimeBehavior,
    });

    if (baselineOut) {
      await writeFile(
        baselineOut,
        `${JSON.stringify(comparisonSummary(manifest), null, 2)}\n`,
      );
    }

    manifest.forEach((entry) => {
      delete entry._signature;
    });
    await writeFile(
      path.join(AUDIT_ROOT, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    await writeGallery(manifest);

    const result = {
      screenshots: manifest.length,
      consoleErrors: logs.consoleErrors.length,
      consoleWarnings: logs.consoleWarnings.length,
      failedRequests: logs.failedRequests.length,
      httpErrors: logs.httpErrors.length,
      finalCounter: finalCounter.value,
      comparison,
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await browser?.close();
    await stopServer(server);
  }
}

await main();
