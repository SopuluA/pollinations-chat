import { edges } from '../state';
import { updateHeaderBadge } from '../ui/header';

export function portXY(nodeId: string, dir: 'in' | 'out'): { x: number; y: number } {
  const el = document.getElementById('node-' + nodeId);
  if (!el) return { x: 0, y: 0 };
  const p = el.querySelector('.port-' + dir);
  if (!p) return { x: 0, y: 0 };
  const canvas = document.getElementById('canvas');
  if (!canvas) return { x: 0, y: 0 };
  const pr = p.getBoundingClientRect();
  const cr = canvas.getBoundingClientRect();
  return { x: pr.left + pr.width / 2 - cr.left, y: pr.top + pr.height / 2 - cr.top };
}

export function bezier(x1: number, y1: number, x2: number, y2: number): string {
  const cy = (y1 + y2) / 2;
  return `M${x1},${y1} C${x1},${cy} ${x2},${cy} ${x2},${y2}`;
}

export function redrawEdges(): void {
  const edgesG = document.getElementById('edges-g');
  if (!edgesG) return;
  edgesG.innerHTML = '';

  for (const edge of edges) {
    const a = portXY(edge.from, 'out');
    const b = portXY(edge.to, 'in');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'edge');
    path.setAttribute('d', bezier(a.x, a.y, b.x, b.y));
    path.setAttribute('marker-end', 'url(#arr)');
    const edgeId = edge.id;
    path.addEventListener('click', () => {
      const idx = edges.findIndex(e => e.id === edgeId);
      if (idx !== -1) edges.splice(idx, 1);
      redrawEdges();
      updateHeaderBadge();
    });
    edgesG.appendChild(path);
  }

  drawMinimap();
}

export function drawMinimap(): void {
  // Minimap is drawn by canvas.ts after redrawEdges call
  import('../canvas/canvas').then(m => m.refreshMinimap()).catch(() => { /* ignore */ });
}
