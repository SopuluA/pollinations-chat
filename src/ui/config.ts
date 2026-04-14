import { nodes, nodeResponses } from '../state';
import { NODE_DEF } from '../nodes/registry';
import { refreshBody } from '../canvas/node-element';
import type { FlowNode, KVPair } from '../types';

// Track current config tab ('request' | 'response')
let currentTab: 'request' | 'response' = 'request';

export function openConfig(nodeId: string): void {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;
  const def = NODE_DEF[node.type];

  const configPanel = document.getElementById('config-panel');
  const configTitle = document.getElementById('config-title');
  if (!configPanel || !configTitle) return;

  configTitle.textContent = `${def.icon} ${def.label}`;
  configPanel.classList.remove('hidden');

  // Build tabs only for request node
  buildTabs(node);
  buildConfig(node);
}

function buildTabs(node: FlowNode): void {
  const tabRow = document.getElementById('config-tabs');
  if (!tabRow) return;
  tabRow.innerHTML = '';

  if (node.type !== 'request') return;

  const tabs: Array<{ key: 'request' | 'response'; label: string }> = [
    { key: 'request', label: 'Request' },
    { key: 'response', label: 'Response' },
  ];

  tabs.forEach(t => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (t.key === currentTab ? ' active' : '');
    tab.textContent = t.label;
    tab.addEventListener('click', () => {
      currentTab = t.key;
      buildTabs(node);
      buildConfig(node);
    });
    tabRow.appendChild(tab);
  });
}

export function buildConfig(node: FlowNode): void {
  const configBody = document.getElementById('config-body');
  if (!configBody) return;
  configBody.innerHTML = '';
  const c = node.config;

  // For request node with tabs, render tab content
  if (node.type === 'request') {
    if (currentTab === 'response') {
      const resp = nodeResponses[node.id];
      if (resp) {
        showResponsePreview(resp);
      } else {
        const p = document.createElement('p');
        p.className = 'hint';
        p.textContent = 'No response yet — run the flow first.';
        configBody.appendChild(p);
      }
      return;
    }
    // fall through to render request fields
  }

  // Label field (always)
  addField(configBody, 'Label', 'text', node.label, v => {
    node.label = v;
    const el = document.querySelector(`#node-${node.id} .node-lbl`);
    if (el) el.textContent = v;
  });

  if (node.type === 'trigger') {
    addField(configBody, 'Input text (optional)', 'textarea', c.input ?? '', v => {
      c.input = v;
      refreshBody(node.id);
    });
    addHint(configBody, 'Leave blank for a manual button trigger. Use {{varName}} to inject variables.');
  }

  if (node.type === 'request') {
    // Method + URL row
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;align-items:flex-end';

    const methodWrap = document.createElement('div');
    methodWrap.className = 'field';
    methodWrap.style.width = '90px';
    const ml = document.createElement('label');
    ml.textContent = 'Method';
    const ms = document.createElement('select');
    (['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as const).forEach(m => {
      const o = document.createElement('option');
      o.value = m; o.textContent = m;
      if (c.method === m) o.selected = true;
      ms.appendChild(o);
    });
    ms.addEventListener('change', () => {
      c.method = ms.value as typeof c.method;
      refreshBody(node.id);
      buildConfig(node);
    });
    methodWrap.append(ml, ms);
    row.appendChild(methodWrap);

    const urlWrap = document.createElement('div');
    urlWrap.className = 'field';
    urlWrap.style.flex = '1';
    const ul = document.createElement('label');
    ul.textContent = 'URL';
    const ui = document.createElement('input');
    ui.type = 'text';
    ui.value = c.url ?? '';
    ui.placeholder = 'https://api.example.com/data';
    ui.addEventListener('input', () => { c.url = ui.value; refreshBody(node.id); });
    urlWrap.append(ul, ui);
    row.appendChild(urlWrap);

    configBody.appendChild(row);

    // Headers
    addKVSection(configBody, 'Headers', (c.headers ??= []), node.id);

    // Auth
    addSelectField(configBody, 'Auth type', ['none', 'bearer', 'api_key', 'basic'], c.auth_type ?? 'none', v => {
      c.auth_type = v as typeof c.auth_type;
      refreshBody(node.id);
      buildConfig(node);
    });
    if (c.auth_type === 'bearer') {
      addField(configBody, 'Bearer token (or {{var}})', 'text', c.auth_value ?? '', v => { c.auth_value = v; });
    }
    if (c.auth_type === 'api_key') {
      addField(configBody, 'Header name', 'text', c.auth_key ?? 'X-API-Key', v => { c.auth_key = v; });
      addField(configBody, 'Key value (or {{var}})', 'text', c.auth_value ?? '', v => { c.auth_value = v; });
    }
    if (c.auth_type === 'basic') {
      addField(configBody, 'user:pass (or {{var}})', 'text', c.auth_value ?? '', v => { c.auth_value = v; });
    }

    // Body
    if (['POST', 'PUT', 'PATCH'].includes(c.method ?? 'GET')) {
      addField(configBody, 'Body (JSON — use {{input}} or {{var}})', 'textarea', c.body ?? '', v => { c.body = v; });
    }
  }

  if (node.type === 'auth') {
    addSelectField(configBody, 'Auth type', ['bearer', 'api_key', 'basic'], c.type ?? 'bearer', v => {
      c.type = v as typeof c.type;
      refreshBody(node.id);
    });
    addField(configBody, 'Value (token / key / user:pass)', 'text', c.value ?? '', v => {
      c.value = v;
      refreshBody(node.id);
    });
    addHint(configBody, 'This node injects auth into the next HTTP Request automatically.');
  }

  if (node.type === 'paginate') {
    addField(configBody, 'Page query param', 'text', c.page_param ?? 'page', v => { c.page_param = v; refreshBody(node.id); });
    addField(configBody, 'Start page', 'number', String(c.start ?? 1), v => { c.start = Number(v); refreshBody(node.id); });
    addField(configBody, 'Max pages', 'number', String(c.max_pages ?? 5), v => { c.max_pages = Number(v); refreshBody(node.id); });
    addHint(configBody, 'Repeats the upstream HTTP Request for each page and concatenates results.');
  }

  if (node.type === 'extract') {
    addField(configBody, 'JSON path (e.g. data.items[0].name)', 'text', c.path ?? '', v => { c.path = v; refreshBody(node.id); });
    addField(configBody, 'Save to variable (optional)', 'text', c.save_as ?? '', v => { c.save_as = v; refreshBody(node.id); });
    addHint(configBody, 'Dot-notation path into the upstream JSON. Use [n] for array index, or [*] to map all items.');
  }

  if (node.type === 'transform') {
    addField(configBody, 'Template / JS ({{input}} = upstream text)', 'textarea', c.template ?? '', v => { c.template = v; refreshBody(node.id); });
    addHint(configBody, 'Pure template: use {{input}} and {{varName}}.\nJS mode: start with `return` to write a function body using `input` (string) and `vars` object.');
  }

  if (node.type === 'set_var') {
    addField(configBody, 'Variable name', 'text', c.name ?? '', v => { c.name = v; refreshBody(node.id); });
    addField(configBody, 'Value ({{input}} or literal)', 'text', c.value ?? '{{input}}', v => { c.value = v; refreshBody(node.id); });
    addHint(configBody, 'Use {{varName}} anywhere in subsequent nodes to reference this value.');
  }

  if (node.type === 'condition') {
    addSelectField(configBody, 'Check field', ['status', 'body', 'header'], c.field ?? 'status', v => {
      c.field = v as typeof c.field;
      refreshBody(node.id);
      buildConfig(node);
    });
    addSelectField(configBody, 'Operator', ['eq', 'neq', 'gt', 'lt', 'contains', 'starts_with'], c.op ?? 'eq', v => {
      c.op = v as typeof c.op;
      refreshBody(node.id);
    });
    addField(configBody, 'Value to compare', 'text', c.val ?? '', v => { c.val = v; refreshBody(node.id); });
    if (c.field === 'header') {
      addField(configBody, 'Header name', 'text', c.header_name ?? '', v => { c.header_name = v; });
    }
    addHint(configBody, 'If condition is not met, node passes null downstream (stops the chain).');
  }

  if (node.type === 'ai') {
    addField(configBody, 'System prompt', 'textarea', c.system ?? '', v => { c.system = v; });
    addField(configBody, 'User message ({{input}} = upstream)', 'textarea', c.prompt ?? '', v => { c.prompt = v; refreshBody(node.id); });
    addHint(configBody, 'Powered by Pollinations AI (free, no key required).');
  }

  if (node.type === 'output') {
    addField(configBody, 'Label', 'text', c.label ?? 'Result', v => { c.label = v; refreshBody(node.id); });
    addSelectField(configBody, 'Format', ['auto', 'json', 'text'], c.format ?? 'auto', v => {
      c.format = v as typeof c.format;
    });
  }
}

// ── Field builders ────────────────────────────────────────────────────────────

function addField(
  parent: HTMLElement,
  lbl: string,
  type: 'text' | 'textarea' | 'number',
  val: string,
  onChange: (v: string) => void,
): void {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const l = document.createElement('label');
  l.textContent = lbl;
  const inp = document.createElement(type === 'textarea' ? 'textarea' : 'input') as HTMLInputElement | HTMLTextAreaElement;
  if (type !== 'textarea') (inp as HTMLInputElement).type = type;
  inp.value = val;
  if (type === 'textarea') (inp as HTMLTextAreaElement).rows = 3;
  inp.addEventListener('input', () => onChange(inp.value));
  wrap.append(l, inp);
  parent.appendChild(wrap);
}

function addSelectField(
  parent: HTMLElement,
  lbl: string,
  options: string[],
  current: string,
  onChange: (v: string) => void,
): void {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const l = document.createElement('label');
  l.textContent = lbl;
  const sel = document.createElement('select');
  options.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o; opt.textContent = o;
    if (o === current) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => onChange(sel.value));
  wrap.append(l, sel);
  parent.appendChild(wrap);
}

function addHint(parent: HTMLElement, txt: string): void {
  const p = document.createElement('p');
  p.className = 'hint';
  p.textContent = txt;
  parent.appendChild(p);
}

function addKVSection(parent: HTMLElement, title: string, arr: KVPair[], nodeId: string): void {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const l = document.createElement('label');
  l.textContent = title;
  const list = document.createElement('div');
  list.className = 'kv-list';

  const renderRows = () => {
    list.innerHTML = '';
    arr.forEach((row, i) => {
      const r = document.createElement('div');
      r.className = 'kv-row';
      const ki = document.createElement('input') as HTMLInputElement;
      ki.placeholder = 'Key'; ki.value = row.k;
      ki.addEventListener('input', () => {
        const item = arr[i];
        if (item) item.k = ki.value;
      });
      const vi = document.createElement('input') as HTMLInputElement;
      vi.placeholder = 'Value'; vi.value = row.v;
      vi.addEventListener('input', () => {
        const item = arr[i];
        if (item) item.v = vi.value;
      });
      const del = document.createElement('button');
      del.className = 'kv-del'; del.textContent = '×';
      del.addEventListener('click', () => { arr.splice(i, 1); renderRows(); });
      r.append(ki, vi, del);
      list.appendChild(r);
    });
    const addBtn = document.createElement('button');
    addBtn.className = 'add-row-btn';
    addBtn.textContent = '+ Add ' + title.toLowerCase().replace(/s$/, '');
    addBtn.addEventListener('click', () => { arr.push({ k: '', v: '' }); renderRows(); });
    list.appendChild(addBtn);
  };

  renderRows();
  wrap.append(l, list);
  parent.appendChild(wrap);
  void nodeId; // suppress unused warning
}

function showResponsePreview(resp: { status: number; body: string; ms: number }): void {
  const configBody = document.getElementById('config-body');
  if (!configBody) return;
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const l = document.createElement('label');
  l.textContent = 'Last response';
  const meta = document.createElement('div');
  meta.className = 'res-meta';
  const st = document.createElement('span');
  st.className = `res-status ${resp.status < 400 ? 'ok' : 'err'}`;
  st.textContent = String(resp.status);
  const tm = document.createElement('span');
  tm.className = 'res-time';
  tm.textContent = resp.ms + 'ms';
  meta.append(st, tm);
  const pre = document.createElement('div');
  pre.className = 'res-preview';
  pre.textContent = resp.body?.slice(0, 600) || '(empty)';
  wrap.append(l, meta, pre);
  configBody.appendChild(wrap);
}

// Reset tab to 'request' when switching nodes
export function resetConfigTab(): void {
  currentTab = 'request';
}

