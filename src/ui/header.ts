import { nodes, edges } from '../state';

export function updateHeaderBadge(): void {
  const badge = document.getElementById('hdr-badge');
  if (!badge) return;
  badge.textContent = `${nodes.length} node${nodes.length !== 1 ? 's' : ''} · ${edges.length} edge${edges.length !== 1 ? 's' : ''}`;
}

export function setProgressBar(pct: number): void {
  const bar = document.getElementById('run-progress') as HTMLElement | null;
  if (!bar) return;
  bar.style.width = pct + '%';
  bar.style.opacity = pct > 0 ? '1' : '0';
}
