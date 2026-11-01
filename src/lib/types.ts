import type Lenis from 'lenis';

export interface ChapterContext {
  lenis: Lenis;
  stitchTotal: number;
  reducedMotion: boolean;
  metrics: readonly ChapterMetrics[];
  loadSequence(name: string, frameCount: number): Promise<HTMLImageElement[]>;
}

export interface Chapter {
  id: string;
  label: string;
  scrollVh: number;
  pinned: boolean;
  releaseTailVh?: number;
  bg: string;
  stitches: number;
  preload?: string[];
  mount(el: HTMLElement, ctx: ChapterContext): void | Promise<void>;
  timeline(tl: gsap.core.Timeline, el: HTMLElement, ctx: ChapterContext): void;
}

export interface ChapterMetrics {
  chapter: Chapter;
  index: number;
  scrollStartVh: number;
  scrollEndVh: number;
  stitchStart: number;
  stitchEnd: number;
}
