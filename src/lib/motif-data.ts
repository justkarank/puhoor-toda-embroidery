import motif1Source from '../motifs/motif-1.svg?raw';
import motif2Source from '../motifs/motif-2.svg?raw';
import motif3Source from '../motifs/motif-3.svg?raw';
import motif4Source from '../motifs/motif-4.svg?raw';
import motif5Source from '../motifs/motif-5.svg?raw';
import motif6Source from '../motifs/motif-6.svg?raw';

export type MotifUnitColor = 'red' | 'black';
export type MotifId = 1 | 2 | 3 | 4 | 5 | 6;

export interface MotifUnit {
  unit: number;
  column: number;
  row: number;
  color: MotifUnitColor;
}

export interface MotifData {
  width: number;
  height: number;
  units: MotifUnit[];
}

const motifSources: Record<MotifId, string> = {
  1: motif1Source,
  2: motif2Source,
  3: motif3Source,
  4: motif4Source,
  5: motif5Source,
  6: motif6Source,
};

const motifCache = new Map<MotifId, MotifData>();

function readViewBox(svg: SVGSVGElement): [number, number] {
  const values = (svg.getAttribute('viewBox') ?? '')
    .trim()
    .split(/\s+/)
    .map(Number);
  const width = values[2];
  const height = values[3];

  if (!(width > 0) || !(height > 0)) {
    throw new Error('The counted motif SVG requires a positive viewBox.');
  }

  return [width, height];
}

export function getMotifData(motifId: MotifId): MotifData {
  const cachedMotif = motifCache.get(motifId);

  if (cachedMotif) {
    return cachedMotif;
  }

  const parsed = new DOMParser().parseFromString(
    motifSources[motifId],
    'image/svg+xml',
  );
  const svg = parsed.documentElement as unknown as SVGSVGElement;
  const [width, height] = readViewBox(svg);
  const units = Array.from(
    parsed.querySelectorAll<SVGRectElement>('rect[data-unit]'),
  )
    .map((rect) => ({
      unit: Number(rect.dataset.unit),
      color: rect.dataset.color === 'black' ? 'black' : 'red',
      column: Number(rect.dataset.x ?? rect.getAttribute('x')),
      row: Number(rect.dataset.y ?? rect.getAttribute('y')),
    }))
    .filter(
      ({ unit, column, row }) =>
        Number.isFinite(unit) &&
        Number.isFinite(column) &&
        Number.isFinite(row),
    )
    .sort((a, b) => a.unit - b.unit) as MotifUnit[];

  const motif = { width, height, units };
  motifCache.set(motifId, motif);
  return motif;
}

export function createMotifSvg(
  motifId: MotifId,
  className = '',
): SVGSVGElement {
  const motif = getMotifData(motifId);
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.classList.add('motif-unit-svg');

  if (className) {
    svg.classList.add(className);
  }

  svg.setAttribute('viewBox', `0 0 ${motif.width} ${motif.height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute(
    'aria-label',
    `Counted motif composed of ${motif.units.length} discrete stitch units`,
  );
  svg.dataset.gridWidth = String(motif.width);
  svg.dataset.gridHeight = String(motif.height);

  motif.units.forEach((unit) => {
    const rect = document.createElementNS(namespace, 'rect');
    rect.id = `motif-${motifId}-unit-${String(unit.unit).padStart(4, '0')}`;
    rect.setAttribute('x', String(unit.column));
    rect.setAttribute('y', String(unit.row));
    rect.setAttribute('width', '1');
    rect.setAttribute('height', '1');
    rect.dataset.unit = String(unit.unit);
    rect.dataset.color = unit.color;
    rect.classList.add(`motif-unit-svg__unit--${unit.color}`);
    rect.setAttribute(
      'fill',
      unit.color === 'red' ? 'var(--red)' : 'var(--black)',
    );
    svg.append(rect);
  });

  return svg;
}
