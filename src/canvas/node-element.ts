import type { FlowNode } from '../types';
import { nodes, edges, connecting, setConnecting, setDragging, selected } from '../state';
import { NODE_DEF } from '../nodes/registry';
import { redrawEdges, portXY, bezier } from './edges';
import { selectNode, deselect } from './canvas';
import { updateHeaderBadge } from '../ui/header';

const GRID = 22;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function preview(node: FlowNode): string {
  const c = node.config;
  switch (node.type) {
    case 'trigger':   return c.input ? c.input.slice(0, 60) : '(manual trigger)';
    case 'request':   return `${c.method ?? 'GET'} ${(c.url ?? '').replace(/^https?:\/\//, '').slice(0, 50) || '(no url)'}`;
    case 'auth':      return `${c.type === 'bearer' ? 'Bearer' : c.type === 'basic' ? 'Basic' : 'API Key'} — ${c.value ? '••••' : '(empty)'}`;
    case 'paginate':  return `${c.page_param ?? 'page'}=1…${c.max_pages ?? 5}`;
    case 'extract':   return c.path ? `→ ${c.path}${c.save_as ? ` → {{${c.save_as}}}` : ''}` : '(no path)';
    case 'transform': return (c.template ?? '').slice(0, 60);
    case 'set_var':   return c.name ? `{{${c.name}}} = ${(c.value ?? '').slice(0, 30)}` : '(no name)';
    case 'condition': return `${c.field ?? 'status'} ${c.op ?? 'eq'} ${c.val ?? ''}`;
    case 'ai':        return (c.prompt ?? '').slice(0, 60);
    case 'output':    return c.label ?? 'Result';
    default: return '';
  }
}

export function refreshBody(id: string): void {
  const node = nodes.find(n => n.id === id);
  const el = document.getElementById('nbody-' + id);
  if (node && el) el.textContent = preview(node);
  const mb = document.getElementById('mbadge-' + id);
  if (mb && node) {
    mb.textContent = node.config.method ?? 'GET';
    mb.className = `method-badge method-${node.config.method ?? 'GET'}`;
  }
}

export function chip(id: string, state: 'idle' | 'run' | 'ok' | 'err', text: string): void {
  const el = document.getElementById('chip-' + id);
  if (el) {
    el.className = `node-chip chip-${state}`;
    el.textContent = text;
  }
}

export function mountNode(node: FlowNode): void {
  const def = NODE_DEF[node.type];
  const el = document.createElement('div');
  el.className = 'node';
  el.id = 'node-' + node.id;
  el.style.left = node.x + 'px';
  el.style.top  = node.y + 'px';

  el.innerHTML = `
    ${def.hasIn ? `<div class="port port-in" data-nid="${node.id}" data-dir="in"></div>` : ''}
    <div class="node-header" style="background:${def.color}12;border-bottom-color:${def.color}28">
      <span class="node-icon">${def.icon}</span>
      <span class="node-lbl">${esc(node.label)}</span>
      ${node.type === 'request'
        ? `<span class="method-badge method-${node.config.method ?? 'GET'}" id="mbadge-${node.id}">${esc(node.config.method ?? 'GET')}</span>`
        : ''}
      <span class="node-chip chip-idle" id="chip-${node.id}">idle</span>
    </div>
    <div class="node-body" id="nbody-${node.id}">${esc(preview(node))}</div>
    ${def.hasOut ? `<div class="port port-out" data-nid="${node.id}" data-dir="out"></div>` : ''}
  `;

  // Drag
  el.addEventListener('mousedown', e => {
    if ((e.target as HTMLElement).classList.contains('port')) return;
    e.preventDefault();
    selectNode(node.id);
    const nr = el.getBoundingClientRect();
    setDragging({ nodeId: node.id, offX: e.clientX - nr.left, offY: e.clientY - nr.top });
  });

  // Ports
  el.querySelectorAll<HTMLElement>('.port').forEach(p => {
    p.addEventListener('mousedown', e => {
      e.stopPropagation();
      e.preventDefault();
      const dir = p.dataset['dir'];
      const nid = p.dataset['nid'] ?? '';
      if (dir === 'out') {
        beginConn(nid, e);
      } else if (dir === 'in' && connecting) {
        endConn(nid);
      }
    });
  });

  // Right-click context menu
  el.addEventListener('contextmenu', e => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, node.id);
  });

  const canvasNodes = document.getElementById('canvas-nodes');
  canvasNodes?.appendChild(el);
}

function beginConn(nodeId: string, _e: MouseEvent): void {
  const pos = portXY(nodeId, 'out');
  setConnecting({ nodeId, x: pos.x, y: pos.y });
  const connLine = document.getElementById('conn-line') as SVGPathElement | null;
  if (connLine) {
    connLine.style.display = '';
    connLine.setAttribute('d', `M${pos.x},${pos.y}`);
  }
}

function endConn(toId: string): void {
  const conn = connecting;
  if (!conn) return;
  const from = conn.nodeId;
  setConnecting(null);
  const connLine = document.getElementById('conn-line') as SVGPathElement | null;
  if (connLine) { connLine.style.display = 'none'; connLine.setAttribute('d', ''); }
  if (from === toId || edges.find(e => e.from === from && e.to === toId)) return;
  edges.push({ id: 'e' + Date.now(), from, to: toId });
  redrawEdges();
  updateHeaderBadge();
}

export function cancelConn(): void {
  setConnecting(null);
  const connLine = document.getElementById('conn-line') as SVGPathElement | null;
  if (connLine) { connLine.style.display = 'none'; connLine.setAttribute('d', ''); }
}

export function updateConnLine(mx: number, my: number): void {
  const conn = connecting;
  if (!conn) return;
  const canvas = document.getElementById('canvas');
  if (!canvas) return;
  const cr = canvas.getBoundingClientRect();
  const connLine = document.getElementById('conn-line') as SVGPathElement | null;
  if (connLine) connLine.setAttribute('d', bezier(conn.x, conn.y, mx - cr.left, my - cr.top));
}

// ── Context menu ──────────────────────────────────────────────────────────────
let activeMenu: HTMLElement | null = null;

function showContextMenu(cx: number, cy: number, nodeId: string): void {
  removeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.style.left = cx + 'px';
  menu.style.top  = cy + 'px';
  menu.innerHTML = `
    <div class="ctx-item" data-action="duplicate">Duplicate</div>
    <div class="ctx-item ctx-item-danger" data-action="delete">Delete</div>
  `;
  menu.addEventListener('click', e => {
    const action = (e.target as HTMLElement).dataset['action'];
    if (action === 'delete') deleteNode(nodeId);
    if (action === 'duplicate') duplicateNode(nodeId);
    removeContextMenu();
  });
  document.body.appendChild(menu);
  activeMenu = menu;
  setTimeout(() => document.addEventListener('click', removeContextMenu, { once: true }), 0);
}

function removeContextMenu(): void {
  activeMenu?.remove();
  activeMenu = null;
}

function deleteNode(id: string): void {
  const idx = nodes.findIndex(n => n.id === id);
  if (idx !== -1) nodes.splice(idx, 1);
  for (let i = edges.length - 1; i >= 0; i--) {
    if (edges[i]?.from === id || edges[i]?.to === id) edges.splice(i, 1);
  }
  document.getElementById('node-' + id)?.remove();
  redrawEdges();
  showEmpty();
  updateHeaderBadge();
  if (selected === id) deselect();
}

function duplicateNode(id: string): void {
  const orig = nodes.find(n => n.id === id);
  if (!orig) return;
  const newId = 'n' + Date.now();
  const clone: typeof orig = {
    ...orig,
    id: newId,
    x: orig.x + GRID * 2,
    y: orig.y + GRID * 2,
    config: JSON.parse(JSON.stringify(orig.config)) as typeof orig.config,
  };
  nodes.push(clone);
  mountNode(clone);
  showEmpty();
  updateHeaderBadge();
}

export function showEmpty(): void {
  const hint = document.getElementById('empty-hint');
  if (hint) hint.style.display = nodes.length === 0 ? '' : 'none';
}
