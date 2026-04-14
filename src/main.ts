import './style.css';
import { nodes, edges, vars, nodeResponses, resetState, setIdSeq } from './state';
import { runFlow } from './engine/runner';
import { initCanvasDragDrop, initMouseHandlers } from './canvas/canvas';
import { mountNode, showEmpty, cancelConn } from './canvas/node-element';
import { redrawEdges } from './canvas/edges';
import { addLog } from './ui/log';
import { renderVars } from './ui/vars';
import { updateHeaderBadge } from './ui/header';
import { openConfig, resetConfigTab } from './ui/config';
import { initSidebarSearch } from './ui/search';
import type { FlowNode, Edge } from './types';

// ── Init ──────────────────────────────────────────────────────────────────────

initCanvasDragDrop();
initMouseHandlers();
initSidebarSearch();

// ── Header buttons ────────────────────────────────────────────────────────────

document.getElementById('btn-run')?.addEventListener('click', () => { void runFlow(); });

document.getElementById('btn-clear')?.addEventListener('click', () => {
  if (!confirm('Clear canvas?')) return;

  // Remove DOM nodes
  document.querySelectorAll<HTMLElement>('.node').forEach(el => el.remove());

  // Reset state
  resetState();

  const edgesG = document.getElementById('edges-g');
  if (edgesG) edgesG.innerHTML = '';

  // Re-show empty hint
  const hint = document.getElementById('empty-hint');
  if (hint) {
    const canvasNodes = document.getElementById('canvas-nodes');
    canvasNodes?.appendChild(hint);
    hint.style.display = '';
  }

  // Close config panel
  document.getElementById('config-panel')?.classList.add('hidden');
  cancelConn();
  renderVars();
  updateHeaderBadge();
  addLog(null, 'Canvas cleared', 'info');
});

document.getElementById('btn-save')?.addEventListener('click', () => {
  const saveData = { nodes, edges, vars, idSeq: nodes.length };
  localStorage.setItem('flow-v2', JSON.stringify(saveData));
  addLog(null, 'Saved', 'info');
});

document.getElementById('btn-load')?.addEventListener('click', () => {
  const raw = localStorage.getItem('flow-v2');
  if (!raw) { addLog(null, 'Nothing saved', 'err'); return; }

  interface SaveData {
    nodes: FlowNode[];
    edges: Edge[];
    vars: Record<string, string>;
    idSeq: number;
  }

  const s = JSON.parse(raw) as SaveData;

  // Clear existing
  document.querySelectorAll<HTMLElement>('.node').forEach(el => el.remove());
  nodes.length = 0;
  edges.length = 0;
  for (const k of Object.keys(vars)) delete vars[k];
  for (const k of Object.keys(nodeResponses)) delete nodeResponses[k];

  const edgesG = document.getElementById('edges-g');
  if (edgesG) edgesG.innerHTML = '';

  // Load
  edges.push(...s.edges);
  for (const [k, v] of Object.entries(s.vars ?? {})) vars[k] = v;
  setIdSeq(s.idSeq ?? 1);

  const hint = document.getElementById('empty-hint');
  hint && (hint.style.display = 'none');

  s.nodes.forEach(n => {
    nodes.push(n);
    mountNode(n);
  });

  redrawEdges();
  renderVars();
  updateHeaderBadge();
  addLog(null, 'Loaded', 'info');
});

// ── Config panel ──────────────────────────────────────────────────────────────

document.getElementById('config-close')?.addEventListener('click', () => {
  document.getElementById('config-panel')?.classList.add('hidden');
  document.querySelectorAll<HTMLElement>('.node').forEach(n => n.classList.remove('selected'));
});

document.getElementById('config-delete')?.addEventListener('click', () => {
  const selectedEl = document.querySelector<HTMLElement>('.node.selected');
  if (!selectedEl) return;
  const id = selectedEl.id.replace('node-', '');

  const idx = nodes.findIndex(n => n.id === id);
  if (idx !== -1) nodes.splice(idx, 1);
  for (let i = edges.length - 1; i >= 0; i--) {
    if (edges[i]?.from === id || edges[i]?.to === id) edges.splice(i, 1);
  }
  selectedEl.remove();

  document.getElementById('config-panel')?.classList.add('hidden');
  redrawEdges();
  showEmpty();
  updateHeaderBadge();
});

// ── Log controls ──────────────────────────────────────────────────────────────

document.getElementById('log-clear')?.addEventListener('click', () => {
  const logEl = document.getElementById('log');
  if (logEl) logEl.innerHTML = '';
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  // Cmd/Ctrl+Enter → Run
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    void runFlow();
    return;
  }

  // Escape → cancel connection / deselect
  if (e.key === 'Escape') {
    cancelConn();
    document.querySelectorAll<HTMLElement>('.node').forEach(n => n.classList.remove('selected'));
    document.getElementById('config-panel')?.classList.add('hidden');
    return;
  }

  // Delete/Backspace on selected node (when not in input)
  if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement === document.body) {
    document.getElementById('config-delete')?.click();
  }
});

// ── Re-open config on node selection that was already open ────────────────────

// Observe config-panel visibility changes to reset tab
const configPanel = document.getElementById('config-panel');
if (configPanel) {
  const observer = new MutationObserver(() => {
    if (configPanel.classList.contains('hidden')) {
      resetConfigTab();
    }
  });
  observer.observe(configPanel, { attributes: true, attributeFilter: ['class'] });
}

// ── Boot ─────────────────────────────────────────────────────────────────────

showEmpty();
addLog(null, 'Flow ready — drag an HTTP Request node to start', 'info');
updateHeaderBadge();

// Export openConfig so executor can call it
export { openConfig };
