import type { FlowNode, HttpCtx, ExecResult } from '../types';
import { nodes, edges, vars, nodeResponses, selected } from '../state';
import { resolveVars, getPath } from '../engine/resolver';
import { setVar } from '../ui/vars';
import { addLog } from '../ui/log';
import { openConfig } from '../ui/config';

const REFERRER = 'pollinations-chat-kohl.vercel.app';

export async function execNode(
  node: FlowNode,
  input: string,
  upCtx: HttpCtx | undefined,
  _outputs: Record<string, string>,
): Promise<ExecResult | null> {
  const c = node.config;
  const val = (s: string) => resolveVars(s).replace(/\{\{input\}\}/g, input);

  switch (node.type) {
    case 'trigger':
      return { text: c.input ? val(c.input) : '(triggered)' };

    case 'auth':
      return { text: input };

    case 'request': {
      const upAuthEdge = edges.filter(e => e.to === node.id)
        .find(e => nodes.find(n => n.id === e.from)?.type === 'auth');
      const authNode = upAuthEdge ? nodes.find(n => n.id === upAuthEdge.from) : undefined;
      const ac = authNode?.config;

      const headers: Record<string, string> = {};
      (c.headers ?? []).forEach(h => { if (h.k) headers[val(h.k)] = val(h.v); });

      if (ac || (c.auth_type && c.auth_type !== 'none')) {
        const atype = ac ? ac.type : c.auth_type;
        const aval  = ac ? (ac.value ?? '') : (c.auth_value ?? '');
        if (atype === 'bearer') headers['Authorization'] = `Bearer ${val(aval)}`;
        if (atype === 'basic')  headers['Authorization'] = `Basic ${btoa(val(aval))}`;
        if (atype === 'api_key') headers[c.auth_key ?? 'X-API-Key'] = val(aval);
      }

      const method = c.method ?? 'GET';
      const url = val(c.url ?? '');
      if (!url) throw new Error('No URL set');

      const opts: RequestInit = { method, headers };
      if (['POST', 'PUT', 'PATCH'].includes(method) && c.body) {
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
        opts.body = val(c.body).replace(/\{\{input\}\}/g, input);
      }

      const t0 = Date.now();
      addLog(node.id, `${method} ${url}`, 'info');
      const res = await fetch(url, opts);
      const ms = Date.now() - t0;
      const text = await res.text();
      let body = text;
      try { body = JSON.stringify(JSON.parse(text), null, 2); } catch { /* not json */ }

      const respHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { respHeaders[k] = v; });
      const httpCtx: HttpCtx = { status: res.status, headers: respHeaders, body, ms };
      nodeResponses[node.id] = httpCtx;
      if (selected === node.id) openConfig(node.id);

      addLog(node.id, `${res.status} ${res.statusText} — ${ms}ms — ${body.length}b`, res.ok ? 'ok' : 'err');
      return { text: body, httpCtx };
    }

    case 'paginate': {
      const reqEdge = edges.filter(e => e.to === node.id)
        .find(e => nodes.find(n => n.id === e.from)?.type === 'request');
      if (!reqEdge) throw new Error('Paginate needs an HTTP Request upstream');
      const reqNode = nodes.find(n => n.id === reqEdge.from);
      if (!reqNode) throw new Error('Request node not found');
      const results: unknown[] = [];
      const startPg = c.start ?? 1;
      const maxPg = c.max_pages ?? 5;
      for (let pg = startPg; pg < startPg + maxPg; pg++) {
        const baseUrl = val(reqNode.config.url ?? '');
        const paramChar = baseUrl.includes('?') ? '&' : '?';
        const pageUrl = baseUrl + paramChar + (c.page_param ?? 'page') + '=' + pg;
        addLog(node.id, `Page ${pg}: GET ${pageUrl}`, 'info');
        const r = await fetch(pageUrl, { method: 'GET' });
        const t = await r.text();
        let parsed: unknown;
        try { parsed = JSON.parse(t); } catch { parsed = t; }
        if (Array.isArray(parsed)) {
          results.push(...parsed);
          if (parsed.length === 0) break;
        } else {
          results.push(parsed);
          break;
        }
      }
      return { text: JSON.stringify(results, null, 2) };
    }

    case 'extract': {
      if (!c.path) return { text: input };
      let obj: unknown;
      try { obj = JSON.parse(input); } catch { throw new Error('Upstream is not valid JSON'); }
      const result = getPath(obj, c.path);
      const out = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result ?? '');
      if (c.save_as) setVar(c.save_as, out);
      return { text: out };
    }

    case 'transform': {
      const tmpl = c.template ?? '';
      let out = val(tmpl);
      const trimmed = tmpl.trim();
      if (trimmed.startsWith('return ') || trimmed.startsWith('const ') || trimmed.startsWith('let ')) {
        try {
          out = String(new Function('input', 'vars', tmpl)(input, vars));
        } catch (e) {
          throw new Error('JS error: ' + (e instanceof Error ? e.message : String(e)));
        }
      }
      return { text: out };
    }

    case 'set_var': {
      if (!c.name) throw new Error('No variable name set');
      const v = val(c.value ?? '{{input}}');
      setVar(c.name, v);
      return { text: input };
    }

    case 'condition': {
      let check = '';
      if (c.field === 'status') check = String(upCtx?.status ?? '');
      else if (c.field === 'header') check = String(upCtx?.headers?.[c.header_name?.toLowerCase() ?? ''] ?? '');
      else check = input;

      const cv = val(c.val ?? '');
      const met = (() => {
        switch (c.op) {
          case 'eq':          return check === cv;
          case 'neq':         return check !== cv;
          case 'gt':          return Number(check) > Number(cv);
          case 'lt':          return Number(check) < Number(cv);
          case 'contains':    return check.includes(cv);
          case 'starts_with': return check.startsWith(cv);
          default: return true;
        }
      })();
      return met ? { text: input } : null;
    }

    case 'ai': {
      const prompt = val(c.prompt ?? '').replace(/\{\{input\}\}/g, input);
      const msgs: Array<{ role: string; content: string }> = [];
      if (c.system) msgs.push({ role: 'system', content: c.system });
      msgs.push({ role: 'user', content: prompt });
      const res = await fetch('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'openai-fast', messages: msgs, stream: false, referrer: REFERRER }),
      });
      if (!res.ok) throw new Error(`Pollinations ${res.status}`);
      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      return { text: data.choices?.[0]?.message?.content ?? 'No response' };
    }

    case 'output':
      return { text: input };

    default:
      return { text: input };
  }
}
