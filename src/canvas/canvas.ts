import { nodes, edges, dragging, connecting, selected, setDragging, setConnecting, setSelected } from '../state';
import { NODE_DEF } from '../nodes/registry';
import { redrawEdges, portXY, bezier } from './edges';
import { mountNode, cancelConn, showEmpty, updateConnLine } from './node-element';
import { openConfig } from '../ui/config';
import { updateHeaderBadge } from '../ui/header';
import type { FlowNode } from '../types';
import { DEFAULTS } from '../nodes/registry';
import type { NodeType } from '../types';

const GRID = 22;

function snap(v: number): number {
  return Math.round(v / GRID) * GRID;
}

export function selectNode(id: string): void {
  document.querySelectorAll<HTMLElement>('.node').forEach(n => n.classList.remove('selected'));
  setSelected(id);
  document.getElementById('node-' + id)?.classList.add('selected');
  openConfig(id);
}

export function deselect(): void {
  document.querySelectorAll<HTMLElement>('.node').forEach(n => n.classList.remove('selected'));
  setSelected(null);
  document.getElementById('config-panel')?.classList.add('hidden');
}

export function createNode(type: NodeType, x: number, y: number): void {
  const id = 'n' + Date.now();
  const node: FlowNode = {
    id,
    type,
    x: snap(Math.max(0, x)),
    y: snap(Math.max(0, y)),
    label: NODE_DEF[type].label,
    config: JSON.parse(JSON.stringify(DEFAULTS[type])) as FlowNode['config'],
  };
  nodes.push(node);
  mountNode(node);
  showEmpty();
  updateHeaderBadge();
}

// ── Drag from sidebar ─────────────────────────────────────────────────────────
let pType: string | null = null;

export function initCanvasDragDrop(): void {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  document.querySelectorAll<HTMLElement>('.palette-item').forEach(item => {
    item.addEventListener('dragstart', e => {
      pType = item.dataset['type'] ?? null;
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
    });
  });

  canvas.addEventListener('dragover', e => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
  canvas.addEventListener('drop', e => {
    e.preventDefault();
    if (!pType) return;
    const cr = canvas.getBoundingClientRect();
    createNode(pType as NodeType, e.clientX - cr.left - 100, e.clientY - cr.top - 44);
    pType = null;
  });

  canvas.addEventListener('mousedown', e => {
    const target = e.target as HTMLElement;
    if (target === canvas || target.classList.contains('canvas-nodes') || target.closest('.empty-hint')) {
      deselect();
      if (connecting) cancelConn();
    }
  });
}

// ── Mouse move / up ───────────────────────────────────────────────────────────
export function initMouseHandlers(): void {
  document.addEventListener('mousemove', e => {
    if (dragging) {
      const canvas = document.getElementById('canvas');
      if (!canvas) return;
      const cr = canvas.getBoundingClientRect();
      const node = nodes.find(n => n.id === dragging!.nodeId);
      if (!node) return;
      node.x = snap(Math.max(0, e.clientX - cr.left - dragging!.offX));
      node.y = snap(Math.max(0, e.clientY - cr.top  - dragging!.offY));
      const el = document.getElementById('node-' + node.id);
      if (el) { el.style.left = node.x + 'px'; el.style.top = node.y + 'px'; }
      redrawEdges();
    }
    if (connecting) {
      updateConnLine(e.clientX, e.clientY);
    }
  });

  document.addEventListener('mouseup', () => { setDragging(null); });
}

// ── Minimap ───────────────────────────────────────────────────────────────────
export function refreshMinimap(): void {
  const mm = document.getElementById('minimap') as HTMLCanvasElement | null;
  if (!mm) return;
  const ctx = mm.getContext('2d');
  if (!ctx) return;

  const W = mm.width;
  const H = mm.height;
  ctx.clearRect(0, 0, W, H);

  if (nodes.length === 0) return;

  // bounding box of all nodes
  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs) + 200;
  const maxY = Math.max(...ys) + 80;
  const bw = maxX - minX || 1;
  const bh = maxY - minY || 1;

  const scaleX = (W - 16) / bw;
  const scaleY = (H - 16) / bh;
  const scale = Math.min(scaleX, scaleY);

  const ox = 8 + ((W - 16) - bw * scale) / 2;
  const oy = 8 + ((H - 16) - bh * scale) / 2;

  // Draw edges
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  for (const edge of edges) {
    const a = nodes.find(n => n.id === edge.from);
    const b = nodes.find(n => n.id === edge.to);
    if (!a || !b) continue;
    const ax = ox + (a.x + 100 - minX) * scale;
    const ay = oy + (a.y + 80  - minY) * scale;
    const bx = ox + (b.x + 100 - minX) * scale;
    const by = oy + (b.y      - minY) * scale;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }

  // Draw nodes as colored dots
  for (const node of nodes) {
    const nx = ox + (node.x + 100 - minX) * scale;
    const ny = oy + (node.y + 40  - minY) * scale;
    const color = NODE_DEF[node.type].color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(nx, ny, Math.max(3, 5 * scale), 0, Math.PI * 2);
    ctx.fill();

    if (selected === node.id) {
      ctx.strokeStyle = '#5b8dee';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

// suppress unused import warning — portXY / bezier are re-exported transitively
void portXY;
void bezier;
