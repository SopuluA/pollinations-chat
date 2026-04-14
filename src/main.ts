import './style.css';
import { nodes, edges, vars, nodeResponses, resetState, setIdSeq } from './state';
import { runFlow } from './engine/runner';
import { initCanvasDragDrop, initMouseHandlers } from './canvas/canvas';
import { mountNode, showEmpty, cancelConn } from './canvas/node-element';
import { redrawEdges } from './canvas/edges';
import { addLog } from './ui/log';
import { renderVars } from './ui/vars';
import { updateHeaderBadge } from './ui/header';
import { resetConfigTab } from './ui/config';
import { initSidebarSearch } from './ui/search';
import { TEMPLATES } from './nodes/templates';
import type { FlowNode, Edge } from './types';

interface SaveData {
  nodes: FlowNode[];
  edges: Edge[];
  vars: Record<string, string>;
  idSeq: number;
}

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

// ── Export / Import ───────────────────────────────────────────────────────────

document.getElementById('btn-export')?.addEventListener('click', () => {
  const data = JSON.stringify({ nodes, edges, vars, version: 2 }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `flow-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  addLog(null, 'Workflow exported', 'info');
});

// Double-click Export button → open import dialog
document.getElementById('btn-export')?.addEventListener('dblclick', () => {
  document.getElementById('import-file')?.click();
});

document.getElementById('import-file')?.addEventListener('change', e => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const s = JSON.parse(ev.target?.result as string) as SaveData;
      document.querySelectorAll<HTMLElement>('.node').forEach(el => el.remove());
      resetState();
      const edgesG = document.getElementById('edges-g');
      if (edgesG) edgesG.innerHTML = '';

      edges.push(...s.edges);
      for (const [k, v] of Object.entries(s.vars ?? {})) vars[k] = v;
      setIdSeq(s.idSeq ?? 1);
      const hint = document.getElementById('empty-hint');
      if (hint) hint.style.display = 'none';
      s.nodes.forEach(n => { nodes.push(n); mountNode(n); });
      redrawEdges(); renderVars(); updateHeaderBadge();
      addLog(null, `Imported: ${file.name}`, 'info');
    } catch {
      addLog(null, 'Invalid workflow file', 'err');
    }
    (e.target as HTMLInputElement).value = '';
  };
  reader.readAsText(file);
});

// ── Templates ─────────────────────────────────────────────────────────────────

document.getElementById('btn-templates')?.addEventListener('click', () => {
  // Build modal
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:#000a;z-index:1000;display:flex;align-items:center;justify-content:center';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#161616;border:1px solid #2a2a2a;border-radius:12px;padding:20px;width:480px;max-width:95vw;display:flex;flex-direction:column;gap:12px';

  const title = document.createElement('div');
  title.style.cssText = 'font-size:0.9rem;font-weight:700;letter-spacing:0.5px;color:#e2e2e2;margin-bottom:4px';
  title.textContent = 'Workflow Templates';
  modal.appendChild(title);

  TEMPLATES.forEach(tpl => {
    const card = document.createElement('div');
    card.style.cssText = 'padding:12px 14px;border:1px solid #2a2a2a;border-radius:8px;cursor:pointer;transition:border-color .15s,background .15s;background:#1c1c1c';
    card.onmouseenter = () => { card.style.borderColor = '#5b8dee'; card.style.background = '#1a1a2a'; };
    card.onmouseleave = () => { card.style.borderColor = '#2a2a2a'; card.style.background = '#1c1c1c'; };

    const name = document.createElement('div');
    name.style.cssText = 'font-size:0.82rem;font-weight:600;color:#e2e2e2;margin-bottom:3px';
    name.textContent = tpl.name;

    const desc = document.createElement('div');
    desc.style.cssText = 'font-size:0.72rem;color:#5a5a5a';
    desc.textContent = tpl.description;

    card.append(name, desc);
    card.addEventListener('click', () => {
      // Clear canvas
      document.querySelectorAll<HTMLElement>('.node').forEach(el => el.remove());
      resetState();
      const edgesG = document.getElementById('edges-g');
      if (edgesG) edgesG.innerHTML = '';

      // Assign IDs
      let seq = 1;
      const idMap: string[] = [];
      tpl.nodes.forEach((n, i) => {
        const id = 'n' + (seq++);
        idMap[i] = id;
        const node: FlowNode = { ...n, id };
        nodes.push(node);
        mountNode(node);
      });
      setIdSeq(seq);

      // Create edges
      tpl.edges.forEach(e => {
        const from = idMap[e.from] ?? '';
        const to   = idMap[e.to]   ?? '';
        if (from && to) edges.push({ id: 'e' + (seq++), from, to });
      });

      const hint = document.getElementById('empty-hint');
      if (hint) hint.style.display = 'none';

      redrawEdges();
      updateHeaderBadge();
      addLog(null, `Loaded template: ${tpl.name}`, 'info');
      document.body.removeChild(overlay);
    });

    modal.appendChild(card);
  });

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Cancel';
  closeBtn.style.cssText = 'margin-top:4px;padding:7px;border:1px solid #2a2a2a;background:none;color:#5a5a5a;border-radius:7px;cursor:pointer;font-size:0.78rem';
  closeBtn.addEventListener('click', () => document.body.removeChild(overlay));
  modal.appendChild(closeBtn);

  overlay.appendChild(modal);
  overlay.addEventListener('click', e => { if (e.target === overlay) document.body.removeChild(overlay); });
  document.body.appendChild(overlay);
});

// ── Boot ─────────────────────────────────────────────────────────────────────

showEmpty();
addLog(null, 'Flow ready — drag an HTTP Request node to start', 'info');
updateHeaderBadge();

