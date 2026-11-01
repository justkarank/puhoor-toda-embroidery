export interface SequenceProgress {
  loadedBytes: number;
  totalBytes: number;
  decodedFrames: number;
  discoveredFrames: number;
  frameCount: number;
  complete: boolean;
  available: boolean;
}

type ProgressListener = (progress: SequenceProgress) => void;

interface SequenceEntry {
  name: string;
  frameCount: number;
  frames: Array<HTMLImageElement | undefined>;
  objectUrls: Set<string>;
  listeners: Set<ProgressListener>;
  abortController: AbortController;
  promise: Promise<HTMLImageElement[]>;
  loadedBytes: number;
  totalBytes: number;
  decodedFrames: number;
  discoveredFrames: number;
  complete: boolean;
  available: boolean;
  disposed: boolean;
  lastUsed: number;
}

interface CanvasState {
  name: string;
  targetIndex: number;
  drawnIndex: number;
  progress: number;
  staticFrame?: HTMLImageElement;
}

export const SEQUENCE_FRAME_COUNTS: Readonly<Record<string, number>> = {
  hero: 96,
  nilgiris: 72,
  closing: 72,
};

const MAX_DECODED_SEQUENCES = 2;
const sequenceCache = new Map<string, SequenceEntry>();
const canvasStates = new Map<HTMLCanvasElement, CanvasState>();
const staticFrameCache = new Map<string, Promise<HTMLImageElement | undefined>>();
let useClock = 0;

function frameUrl(name: string, index: number): string {
  return `/assets/${name}/${String(index + 1).padStart(4, '0')}.webp`;
}

export function loadStaticSequenceFrame(
  name: string,
  frameNumber: number,
): Promise<HTMLImageElement | undefined> {
  const safeFrameNumber = Math.max(1, Math.floor(frameNumber));
  const key = `${name}:${safeFrameNumber}`;
  const existing = staticFrameCache.get(key);

  if (existing) {
    return existing;
  }

  const promise = (async () => {
    try {
      const response = await fetch(frameUrl(name, safeFrameNumber - 1));

      if (!response.ok) {
        return undefined;
      }

      const objectUrl = URL.createObjectURL(await response.blob());
      const image = new Image();
      image.decoding = 'async';
      image.src = objectUrl;
      await image.decode();
      return image;
    } catch {
      return undefined;
    }
  })();

  staticFrameCache.set(key, promise);
  return promise;
}

function report(entry: SequenceEntry): void {
  const progress: SequenceProgress = {
    loadedBytes: entry.loadedBytes,
    totalBytes: entry.totalBytes,
    decodedFrames: entry.decodedFrames,
    discoveredFrames: entry.discoveredFrames,
    frameCount: entry.frameCount,
    complete: entry.complete,
    available: entry.available,
  };

  entry.listeners.forEach((listener) => listener(progress));
}

function touch(entry: SequenceEntry): void {
  useClock += 1;
  entry.lastUsed = useClock;
}

function releaseEntry(name: string): void {
  const entry = sequenceCache.get(name);

  if (!entry) {
    return;
  }

  entry.disposed = true;
  entry.abortController.abort();
  entry.frames.forEach((frame) => {
    if (frame) {
      frame.src = '';
    }
  });
  entry.objectUrls.forEach((url) => URL.revokeObjectURL(url));
  entry.objectUrls.clear();
  entry.frames.length = 0;
  entry.listeners.clear();
  sequenceCache.delete(name);

  canvasStates.forEach((state, canvas) => {
    if (state.name === name) {
      state.targetIndex = -1;
      state.drawnIndex = -1;
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    }
  });
}

function makeRoomFor(name: string): void {
  if (sequenceCache.has(name)) {
    return;
  }

  while (sequenceCache.size >= MAX_DECODED_SEQUENCES) {
    const oldest = Array.from(sequenceCache.values()).sort(
      (a, b) => a.lastUsed - b.lastUsed,
    )[0];

    if (!oldest) {
      return;
    }

    releaseEntry(oldest.name);
  }
}

async function readResponse(
  response: Response,
  entry: SequenceEntry,
): Promise<Blob> {
  const declaredBytes = Number(response.headers.get('content-length')) || 0;

  if (declaredBytes > 0) {
    entry.totalBytes += declaredBytes;
  }

  entry.discoveredFrames += 1;
  report(entry);

  if (!response.body) {
    const blob = await response.blob();
    entry.loadedBytes += blob.size;

    if (declaredBytes === 0) {
      entry.totalBytes += blob.size;
    }

    report(entry);
    return blob;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    chunks.push(value);
    receivedBytes += value.byteLength;
    entry.loadedBytes += value.byteLength;
    report(entry);
  }

  if (declaredBytes === 0) {
    entry.totalBytes += receivedBytes;
    report(entry);
  }

  return new Blob(
    chunks.map((chunk) => Uint8Array.from(chunk).buffer),
    {
    type: response.headers.get('content-type') ?? 'image/webp',
    },
  );
}

async function decodeFrame(
  entry: SequenceEntry,
  index: number,
): Promise<HTMLImageElement | undefined> {
  try {
    const response = await fetch(frameUrl(entry.name, index), {
      signal: entry.abortController.signal,
    });

    if (!response.ok || entry.disposed) {
      return undefined;
    }

    const blob = await readResponse(response, entry);

    if (entry.disposed) {
      return undefined;
    }

    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.decoding = 'async';
    image.src = objectUrl;
    entry.objectUrls.add(objectUrl);
    await image.decode();

    if (entry.disposed) {
      image.src = '';
      URL.revokeObjectURL(objectUrl);
      entry.objectUrls.delete(objectUrl);
      return undefined;
    }

    entry.frames[index] = image;
    entry.decodedFrames += 1;
    report(entry);
    redrawSequenceCanvases(entry);
    return image;
  } catch {
    return undefined;
  }
}

async function decodeRemainingFrames(entry: SequenceEntry): Promise<void> {
  const pending = Array.from(
    { length: Math.max(0, entry.frameCount - 1) },
    (_, index) => index + 1,
  );
  const workers = Array.from(
    { length: Math.min(6, pending.length) },
    async () => {
      while (pending.length > 0 && !entry.disposed) {
        const index = pending.shift();

        if (index !== undefined) {
          await decodeFrame(entry, index);
        }
      }
    },
  );

  await Promise.all(workers);
}

function createEntry(name: string, frameCount: number): SequenceEntry {
  makeRoomFor(name);

  const entry: SequenceEntry = {
    name,
    frameCount,
    frames: Array.from({ length: frameCount }),
    objectUrls: new Set<string>(),
    listeners: new Set<ProgressListener>(),
    abortController: new AbortController(),
    promise: Promise.resolve<HTMLImageElement[]>([]),
    loadedBytes: 0,
    totalBytes: 0,
    decodedFrames: 0,
    discoveredFrames: 0,
    complete: false,
    available: true,
    disposed: false,
    lastUsed: 0,
  };

  touch(entry);
  sequenceCache.set(name, entry);
  entry.promise = (async () => {
    const firstFrame = await decodeFrame(entry, 0);

    if (!firstFrame || entry.disposed) {
      entry.available = false;
      entry.complete = true;
      report(entry);
      return [];
    }

    await decodeRemainingFrames(entry);
    entry.complete = true;
    report(entry);
    return entry.frames.filter(
      (frame): frame is HTMLImageElement => Boolean(frame),
    );
  })().catch(() => {
    entry.available = false;
    entry.complete = true;
    report(entry);
    return [];
  });

  return entry;
}

function getEntry(name: string, frameCount: number): SequenceEntry {
  const existing = sequenceCache.get(name);

  if (existing) {
    touch(existing);
    return existing;
  }

  return createEntry(name, Math.max(0, Math.floor(frameCount)));
}

export function loadSequence(
  name: string,
  frameCount: number,
): Promise<HTMLImageElement[]> {
  if (frameCount <= 0) {
    return Promise.resolve([]);
  }

  return getEntry(name, frameCount).promise;
}

export function loadSequenceWithProgress(
  name: string,
  frameCount: number,
  listener: ProgressListener,
): Promise<HTMLImageElement[]> {
  if (frameCount <= 0) {
    listener({
      loadedBytes: 0,
      totalBytes: 0,
      decodedFrames: 0,
      discoveredFrames: 0,
      frameCount: 0,
      complete: true,
      available: false,
    });
    return Promise.resolve([]);
  }

  const entry = getEntry(name, frameCount);
  entry.listeners.add(listener);
  report(entry);

  return entry.promise.finally(() => {
    entry.listeners.delete(listener);
  });
}

export function preloadSequences(names: readonly string[]): void {
  names.forEach((name) => {
    const frameCount = SEQUENCE_FRAME_COUNTS[name];

    if (frameCount) {
      void loadSequence(name, frameCount);
    }
  });
}

export function releaseSequence(name: string): void {
  releaseEntry(name);
}

function bestDecodedIndex(
  frames: Array<HTMLImageElement | undefined>,
  targetIndex: number,
): number {
  for (let index = targetIndex; index >= 0; index -= 1) {
    if (frames[index]) {
      return index;
    }
  }

  return frames.findIndex(Boolean);
}

export function drawCoverFrame(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
): void {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;

  context.clearRect(0, 0, width, height);
  context.drawImage(
    image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

export function drawSequenceFrame(
  name: string,
  frameCount: number,
  progress: number,
  canvas: HTMLCanvasElement,
): void {
  const entry = getEntry(name, frameCount);
  drawEntryFrame(entry, progress, canvas);
}

export function updateSequenceCanvas(
  name: string,
  frameCount: number,
  progress: number,
  canvas: HTMLCanvasElement,
): void {
  const entry = sequenceCache.get(name);

  if (entry) {
    drawEntryFrame(entry, progress, canvas);
    return;
  }

  if (progress > 0) {
    drawSequenceFrame(name, frameCount, progress, canvas);
    return;
  }

  canvasStates.set(canvas, {
    name,
    targetIndex: -1,
    drawnIndex: -1,
    progress: Math.min(1, Math.max(0, progress)),
  });
}

function drawEntryFrame(
  entry: SequenceEntry,
  progress: number,
  canvas: HTMLCanvasElement,
): void {
  const boundedProgress = Math.min(1, Math.max(0, progress));
  const targetIndex = Math.round(boundedProgress * (entry.frameCount - 1));
  const drawnIndex = bestDecodedIndex(entry.frames, targetIndex);
  const previous = canvasStates.get(canvas);

  if (
    previous?.name === entry.name &&
    previous.targetIndex === targetIndex &&
    previous.drawnIndex === drawnIndex
  ) {
    return;
  }

  canvasStates.set(canvas, {
    name: entry.name,
    targetIndex,
    drawnIndex,
    progress: boundedProgress,
  });

  if (drawnIndex < 0) {
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const image = entry.frames[drawnIndex];
  const context = canvas.getContext('2d');

  if (!image || !context || image.naturalWidth === 0) {
    return;
  }

  drawCoverFrame(context, image, canvas.width, canvas.height);
}

function redrawSequenceCanvases(entry: SequenceEntry): void {
  canvasStates.forEach((state, canvas) => {
    if (state.name === entry.name) {
      drawEntryFrame(entry, state.progress, canvas);
    }
  });
}

export function registerSequenceCanvas(
  name: string,
  progress: number,
  canvas: HTMLCanvasElement,
): void {
  canvasStates.set(canvas, {
    name,
    targetIndex: -1,
    drawnIndex: -1,
    progress: Math.min(1, Math.max(0, progress)),
  });

  const entry = sequenceCache.get(name);

  if (entry) {
    drawEntryFrame(entry, progress, canvas);
  }
}

export function redrawSequenceCanvas(canvas: HTMLCanvasElement): void {
  const state = canvasStates.get(canvas);

  if (!state) {
    return;
  }

  if (state.staticFrame) {
    const context = canvas.getContext('2d');

    if (context) {
      drawCoverFrame(context, state.staticFrame, canvas.width, canvas.height);
      state.drawnIndex = state.targetIndex;
    }
    return;
  }

  const entry = sequenceCache.get(state.name);

  if (!entry) {
    return;
  }

  state.targetIndex = -1;
  state.drawnIndex = -1;
  drawEntryFrame(entry, state.progress, canvas);
}

export function invalidateSequenceCanvas(canvas: HTMLCanvasElement): void {
  const state = canvasStates.get(canvas);

  if (state) {
    state.targetIndex = -1;
    state.drawnIndex = -1;
  }
}

export function registerStaticSequenceCanvas(
  name: string,
  frameNumber: number,
  canvas: HTMLCanvasElement,
): void {
  const safeFrameNumber = Math.max(1, Math.floor(frameNumber));
  const state: CanvasState = {
    name,
    targetIndex: safeFrameNumber - 1,
    drawnIndex: -1,
    progress: 0,
  };
  canvasStates.set(canvas, state);

  void loadStaticSequenceFrame(name, safeFrameNumber).then((image) => {
    if (!image || canvasStates.get(canvas) !== state) {
      return;
    }

    state.staticFrame = image;
    redrawSequenceCanvas(canvas);
  });
}
