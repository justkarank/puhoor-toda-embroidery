export function mountLattice(): HTMLDivElement {
  const lattice = document.createElement('div');
  lattice.className = 'lattice';
  lattice.setAttribute('aria-hidden', 'true');
  document.body.prepend(lattice);
  return lattice;
}
