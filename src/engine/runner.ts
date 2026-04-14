import { nodes, edges, running, setRunning } from '../state';
import { execNode } from '../nodes/executor';
import { chip } from '../canvas/node-element';
import { addLog } from '../ui/log';
import { updateHeaderBadge, setProgressBar } from '../ui/header';
import type { HttpCtx } from '../types';

export function topoSort(): string[] | null {
  const visited = new Set<string>();
  const stack: string[] = [];
  const visiting = new Set<string>();

  function visit(id: string): boolean {
    if (visiting.has(id)) return false;
    if (visited.has(id)) return true;
    visiting.add(id);
    for (const e of edges) {
      if (e.from === id) {
        if (!visit(e.to)) return false;
      }
    }
    visiting.delete(id);
    visited.add(id);
    stack.unshift(id);
    return true;
  }

  for (const n of nodes) {
    if (!visit(n.id)) return null;
  }
  return stack;
}

export async function runFlow(): Promise<void> {
  if (running) return;
  setRunning(true);

  const btnRun = document.getElementById('btn-run') as HTMLButtonElement;
  btnRun.disabled = true;
  btnRun.textContent = 'Running…';

  nodes.forEach(n => chip(n.id, 'idle', 'idle'));
  setProgressBar(0);
  addLog(null, '── Run started ──', 'info');

  const order = topoSort();
  if (!order) {
    addLog(null, 'Cycle detected', 'err');
    finish();
    return;
  }

  const outputs: Record<string, string> = {};
  const nodeCtx: Record<string, HttpCtx> = {};
  let completed = 0;

  for (const nodeId of order) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) continue;
    chip(nodeId, 'run', 'running');

    const upEdges = edges.filter(e => e.to === nodeId);
    const input = upEdges.map(e => outputs[e.from] ?? '').filter(Boolean).join('\n');
    const upReq = upEdges.map(e => nodeCtx[e.from]).find(Boolean);

    try {
      const res = await execNode(node, input, upReq, outputs);
      if (res === null) {
        chip(nodeId, 'ok', 'skipped');
        addLog(nodeId, '(condition not met — skipped)', 'info');
      } else {
        outputs[nodeId] = res.text ?? '';
        if (res.httpCtx) nodeCtx[nodeId] = res.httpCtx;
        chip(nodeId, 'ok', res.httpCtx ? String(res.httpCtx.status) : 'ok');
        addLog(nodeId, String(res.text ?? '').slice(0, 300), 'ok');
      }
    } catch (err) {
      chip(nodeId, 'err', 'error');
      addLog(nodeId, err instanceof Error ? err.message : String(err), 'err');
      outputs[nodeId] = '';
    }

    completed++;
    setProgressBar(order.length > 0 ? (completed / order.length) * 100 : 100);
  }

  finish();
}

function finish() {
  setRunning(false);
  const btnRun = document.getElementById('btn-run') as HTMLButtonElement;
  btnRun.disabled = false;
  btnRun.textContent = '▶ Run';
  addLog(null, '── Run complete ──', 'info');
  setTimeout(() => setProgressBar(0), 1200);
  updateHeaderBadge();
}
