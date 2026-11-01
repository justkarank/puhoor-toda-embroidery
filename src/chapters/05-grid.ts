import type { Chapter } from '../lib/types';
import { finishTimeline } from '../lib/chapter-utils';
import { mountGridEngine } from '../lib/grid-engine';

export const grid: Chapter = {
  id: 'grid',
  label: 'Grid',
  scrollVh: 140,
  pinned: true,
  releaseTailVh: 12,
  bg: 'var(--cloth)',
  stitches: 940,
  mount(el, ctx) {
    mountGridEngine(el, ctx);
  },
  timeline(tl, el) {
    const engine = el.querySelector('.grid-engine');

    if (engine) {
      tl.fromTo(
        engine,
        { opacity: 0.6 },
        { opacity: 1, duration: 0.12, ease: 'none' },
      );
    }

    finishTimeline(tl, el);
  },
};
