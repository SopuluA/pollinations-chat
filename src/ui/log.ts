import { nodes } from '../state';
import { NODE_DEF } from '../nodes/registry';

export type LogType = 'ok' | 'err' | 'info' | 'warn' | '';

const ICONS: Record<LogType, string> = {
  ok:   '✓',
  err:  '✗',
  info: 'ℹ',
  warn: '⚠',
  '':   '·',
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getTagColor(nodeId: string): string {
  const node = nodes.find(n => n.id === nodeId);
  return node ? (NODE_DEF[node.type]?.color ?? 'var(--muted)') : 'var(--muted)';
}

export function addLog(tag: string | null, msg: string, type: LogType = ''): void {
  const logEl = document.getElementById('log');
  if (!logEl) return;

  const d = document.createElement('div');
  d.className = `le le-${type || 'default'}`;

  const t = new Date().toLocaleTimeString('en-US', { hour12: false });
  const name = tag ? (nodes.find(n => n.id === tag)?.label ?? tag) : '—';
  const icon = ICONS[type] ?? '·';

  d.innerHTML = `
    <span class="le-icon le-icon-${type || 'default'}">${icon}</span>
    <span class="le-time">${esc(t)}</span>
    <span class="le-tag" style="color:${tag ? getTagColor(tag) : 'var(--muted)'}">${esc(name)}</span>
    <span class="le-msg le-msg-${type || 'default'}">${esc(String(msg))}</span>
  `;

  logEl.appendChild(d);
  logEl.scrollTop = logEl.scrollHeight;
}
