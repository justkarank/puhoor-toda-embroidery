import { getMotifData } from './motif-data';
import { GRID_DEMO_CONTENT } from '../content/temporary-demo';
import type { ChapterContext } from './types';

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 640;
const CELL_SIZE = 22;
const GRID_COLUMNS = 40;
const GRID_ROWS = 28;
const GRID_X = (CANVAS_WIDTH - GRID_COLUMNS * CELL_SIZE) / 2;
const GRID_Y = (CANVAS_HEIGHT - GRID_ROWS * CELL_SIZE) / 2;

type StitchColor = 'red' | 'black';

interface Cell {
  column: number;
  row: number;
}

function resolveToken(token: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
}

function createButton(
  label: string,
  className = 'grid-engine__button',
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
}

function cellKey({ column, row }: Cell): string {
  return `${column}:${row}`;
}

function getCell(event: PointerEvent, canvas: HTMLCanvasElement): Cell | null {
  const bounds = canvas.getBoundingClientRect();
  const scaleX = canvas.width / bounds.width;
  const scaleY = canvas.height / bounds.height;
  const x = (event.clientX - bounds.left) * scaleX - GRID_X;
  const y = (event.clientY - bounds.top) * scaleY - GRID_Y;
  const column = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);

  if (
    column < 0 ||
    column >= GRID_COLUMNS ||
    row < 0 ||
    row >= GRID_ROWS
  ) {
    return null;
  }

  return { column, row };
}

function drawStitch(
  context: CanvasRenderingContext2D,
  cell: Cell,
  color: string,
  opacity = 1,
): void {
  const x = GRID_X + cell.column * CELL_SIZE;
  const y = GRID_Y + cell.row * CELL_SIZE;
  const inset = 4.5;

  context.save();
  context.globalAlpha = opacity;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  context.beginPath();
  context.strokeStyle = 'rgba(21, 19, 19, 0.14)';
  context.lineWidth = 3.5;
  context.moveTo(x + inset + 0.6, y + CELL_SIZE - inset + 0.6);
  context.lineTo(x + CELL_SIZE - inset + 0.6, y + inset + 0.6);
  context.stroke();

  context.beginPath();
  context.strokeStyle = color;
  context.lineWidth = 2.5;
  context.moveTo(x + inset, y + CELL_SIZE - inset);
  context.lineTo(x + CELL_SIZE - inset, y + inset);
  context.stroke();

  context.beginPath();
  context.strokeStyle = color;
  context.globalAlpha = opacity * 0.7;
  context.lineWidth = 1.25;
  context.moveTo(x + inset + 3.2, y + CELL_SIZE - inset);
  context.lineTo(x + CELL_SIZE - inset, y + inset + 3.2);
  context.stroke();
  context.restore();
}

export function mountGridEngine(
  host: HTMLElement,
  ctx: ChapterContext,
): void {
  const motif = getMotifData(4);
  const motifOffsetX = Math.floor((GRID_COLUMNS - motif.width) / 2);
  const motifOffsetY = Math.floor((GRID_ROWS - motif.height) / 2);
  const stitches = new Map<string, StitchColor>();
  const wrapper = document.createElement('div');
  wrapper.className = 'grid-engine';

  const canvasShell = document.createElement('div');
  canvasShell.className = 'grid-engine__canvas-shell';

  const canvas = document.createElement('canvas');
  canvas.className = 'grid-engine__canvas';
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  canvas.setAttribute(
    'aria-label',
    'A forty by twenty-eight counted stitch grid. Click or drag to place stitches.',
  );

  const readout = document.createElement('output');
  readout.className = 'grid-engine__readout type-counter';
  readout.setAttribute('aria-live', 'polite');

  const visitorItem = document.createElement('div');
  visitorItem.className = 'grid-engine__readout-item';
  const visitorLabel = document.createElement('span');
  visitorLabel.textContent = 'YOUR STITCHES';
  const visitorCount = document.createElement('strong');
  visitorCount.textContent = '0';
  const visitorExplanation = document.createElement('p');
  visitorExplanation.textContent = GRID_DEMO_CONTENT.visitorExplanation;
  const totalLabel = document.createElement('span');
  totalLabel.textContent = 'EXHIBITION MODEL';
  const totalCount = document.createElement('strong');
  totalCount.textContent = ctx.stitchTotal.toLocaleString('en-IN');
  visitorItem.append(visitorLabel, visitorCount, visitorExplanation);

  const modelItem = document.createElement('div');
  modelItem.className = 'grid-engine__readout-item';
  const modelExplanation = document.createElement('p');
  modelExplanation.textContent = GRID_DEMO_CONTENT.modelExplanation;
  const arithmetic = document.createElement('p');
  arithmetic.textContent = GRID_DEMO_CONTENT.arithmetic;
  const definitions = document.createElement('ul');
  definitions.className = 'grid-engine__definitions';
  GRID_DEMO_CONTENT.definitions.forEach((definition) => {
    const item = document.createElement('li');
    item.textContent = definition;
    definitions.append(item);
  });
  const clarification = document.createElement('p');
  clarification.textContent = GRID_DEMO_CONTENT.clarification;
  modelItem.append(
    totalLabel,
    totalCount,
    modelExplanation,
    arithmetic,
    definitions,
    clarification,
  );
  readout.dataset.contentStatus = 'temporary-demo';
  readout.append(visitorItem, modelItem);

  canvasShell.append(canvas, readout);

  const rail = document.createElement('aside');
  rail.className = 'grid-engine__rail';
  rail.setAttribute('aria-label', 'Counted grid controls');

  const eyebrow = document.createElement('p');
  eyebrow.className = 'grid-engine__eyebrow type-label';
  eyebrow.textContent = 'CHAPTER 05 — COUNT IT YOURSELF';

  const heading = document.createElement('h2');
  heading.className = 'grid-engine__heading type-heading';
  heading.textContent = 'Place a stitch.';

  const instruction = document.createElement('p');
  instruction.className = 'grid-engine__instruction type-annotation';
  instruction.textContent =
    'Click or drag. Every mark mirrors across the centre in this reconstruction.';

  const swatchLabel = document.createElement('p');
  swatchLabel.className = 'grid-engine__control-label type-label';
  swatchLabel.textContent = 'Thread';

  const swatches = document.createElement('div');
  swatches.className = 'grid-engine__swatches';
  swatches.setAttribute('role', 'group');
  swatches.setAttribute('aria-label', 'Thread colour');

  const redSwatch = createButton(
    'Red',
    'grid-engine__swatch grid-engine__swatch--red',
  );
  redSwatch.setAttribute('aria-pressed', 'true');
  const blackSwatch = createButton(
    'Black',
    'grid-engine__swatch grid-engine__swatch--black',
  );
  blackSwatch.setAttribute('aria-pressed', 'false');
  swatches.append(redSwatch, blackSwatch);

  const mirrorButton = createButton('Mirror · on');
  mirrorButton.setAttribute('aria-pressed', 'true');

  const revealButton = createButton('Reveal original');
  revealButton.setAttribute('aria-pressed', 'false');

  const resetButton = createButton('Reset');
  const downloadButton = createButton('Download');

  rail.append(
    eyebrow,
    heading,
    instruction,
    swatchLabel,
    swatches,
    mirrorButton,
    revealButton,
    resetButton,
    downloadButton,
  );
  wrapper.append(canvasShell, rail);
  host.append(wrapper);

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('The counted grid requires Canvas 2D support.');
  }

  let selectedColor: StitchColor = 'red';
  let mirrorEnabled = true;
  let originalVisible = false;
  let drawing = false;
  let dragCells = new Set<string>();

  const render = () => {
    const black = resolveToken('--black');
    const red = resolveToken('--red');
    const cloth = resolveToken('--cloth-lit');

    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    context.fillStyle = cloth;
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    context.save();
    context.strokeStyle = black;
    context.globalAlpha = 0.2;
    context.lineWidth = 0.5;
    context.beginPath();

    for (let column = 0; column <= GRID_COLUMNS; column += 1) {
      const x = GRID_X + column * CELL_SIZE + 0.25;
      context.moveTo(x, GRID_Y);
      context.lineTo(x, GRID_Y + GRID_ROWS * CELL_SIZE);
    }

    for (let row = 0; row <= GRID_ROWS; row += 1) {
      const y = GRID_Y + row * CELL_SIZE + 0.25;
      context.moveTo(GRID_X, y);
      context.lineTo(GRID_X + GRID_COLUMNS * CELL_SIZE, y);
    }

    context.stroke();
    context.restore();

    if (mirrorEnabled) {
      context.save();
      context.strokeStyle = red;
      context.globalAlpha = 0.28;
      context.lineWidth = 0.5;
      context.setLineDash([3, 5]);
      context.beginPath();
      context.moveTo(CANVAS_WIDTH / 2 + 0.25, GRID_Y);
      context.lineTo(
        CANVAS_WIDTH / 2 + 0.25,
        GRID_Y + GRID_ROWS * CELL_SIZE,
      );
      context.stroke();
      context.restore();
    }

    if (originalVisible) {
      motif.units.forEach((unit) => {
        drawStitch(
          context,
          {
            column: motifOffsetX + unit.column,
            row: motifOffsetY + unit.row,
          },
          unit.color === 'red' ? red : black,
          0.2,
        );
      });
    }

    stitches.forEach((color, key) => {
      const [column, row] = key.split(':').map(Number);
      drawStitch(context, { column, row }, color === 'red' ? red : black);
    });

    visitorCount.textContent = stitches.size.toLocaleString('en-IN');
  };

  const placeCell = (cell: Cell) => {
    const key = cellKey(cell);

    if (dragCells.has(key)) {
      return;
    }

    dragCells.add(key);
    stitches.set(key, selectedColor);

    if (mirrorEnabled) {
      const mirrored = {
        column: GRID_COLUMNS - 1 - cell.column,
        row: cell.row,
      };
      stitches.set(cellKey(mirrored), selectedColor);
    }

    render();
  };

  const placeFromPointer = (event: PointerEvent) => {
    const cell = getCell(event, canvas);

    if (cell) {
      placeCell(cell);
    }
  };

  canvas.addEventListener('pointerdown', (event) => {
    drawing = true;
    dragCells = new Set<string>();
    canvas.setPointerCapture(event.pointerId);
    placeFromPointer(event);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (drawing) {
      placeFromPointer(event);
    }
  });

  const finishDrawing = (event: PointerEvent) => {
    drawing = false;
    dragCells.clear();

    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  };

  canvas.addEventListener('pointerup', finishDrawing);
  canvas.addEventListener('pointercancel', finishDrawing);

  redSwatch.addEventListener('click', () => {
    selectedColor = 'red';
    redSwatch.setAttribute('aria-pressed', 'true');
    blackSwatch.setAttribute('aria-pressed', 'false');
  });

  blackSwatch.addEventListener('click', () => {
    selectedColor = 'black';
    redSwatch.setAttribute('aria-pressed', 'false');
    blackSwatch.setAttribute('aria-pressed', 'true');
  });

  mirrorButton.addEventListener('click', () => {
    mirrorEnabled = !mirrorEnabled;
    mirrorButton.setAttribute('aria-pressed', String(mirrorEnabled));
    mirrorButton.textContent = `Mirror · ${mirrorEnabled ? 'on' : 'off'}`;
    render();
  });

  revealButton.addEventListener('click', () => {
    originalVisible = !originalVisible;
    revealButton.setAttribute('aria-pressed', String(originalVisible));
    revealButton.textContent = originalVisible
      ? 'Hide original'
      : 'Reveal original';
    render();
  });

  resetButton.addEventListener('click', () => {
    stitches.clear();
    dragCells.clear();
    render();
  });

  downloadButton.addEventListener('click', () => {
    canvas.toBlob((blob) => {
      if (!blob) {
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'toda-counted-grid.png';
      link.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  });

  render();
}
