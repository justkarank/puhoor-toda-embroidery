import type { Chapter } from '../lib/types';
import { hero } from './01-hero';
import { about } from './02-about';
import { construction } from './03-construction';
import { motifs } from './04-motifs';
import { grid } from './05-grid';
import { nilgiris } from './06-nilgiris';
import { artisans } from './07-artisans';
import { closing } from './08-closing';

export const chapters: Chapter[] = [
  hero,
  about,
  construction,
  motifs,
  grid,
  nilgiris,
  artisans,
  closing,
];
