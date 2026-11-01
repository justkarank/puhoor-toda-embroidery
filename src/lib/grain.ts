export function mountGrain(reducedMotion: boolean): HTMLDivElement | null {
  if (reducedMotion) {
    return null;
  }

  const grain = document.createElement('div');
  grain.className = 'grain';
  grain.setAttribute('aria-hidden', 'true');
  document.body.append(grain);
  return grain;
}
