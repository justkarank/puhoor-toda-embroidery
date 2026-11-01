export const STITCH_UNITS_PER_REPEAT = 334;
export const STITCH_REPEATS_PER_BAND = 32;
export const STITCH_BANDS = 6;

// Credit arithmetic: 334 units × 32 repeats × 6 bands = 64,128 stitches.
export const STITCH_TOTAL =
  STITCH_UNITS_PER_REPEAT * STITCH_REPEATS_PER_BAND * STITCH_BANDS;

export const BACKGROUND_BLEED_VH = 60;
export const LIGHT_GROUNDS = new Set(['var(--cloth)', 'var(--cloth-lit)', 'var(--red-cloth)']);
