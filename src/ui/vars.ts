import { vars } from '../state';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function setVar(k: string, v: string): void {
  vars[k] = v;
  renderVars();
}

export function renderVars(): void {
  const varList = document.getElementById('var-list');
  if (!varList) return;
  const keys = Object.keys(vars);
  if (!keys.length) {
    varList.innerHTML = '<div class="var-empty">No variables set yet.</div>';
    return;
  }
  varList.innerHTML = keys.map(k =>
    `<div class="var-item">
      <span class="var-key">{{${esc(k)}}}</span>
      <span class="var-val">${esc(String(vars[k] ?? '').slice(0, 30))}</span>
    </div>`
  ).join('');
}
