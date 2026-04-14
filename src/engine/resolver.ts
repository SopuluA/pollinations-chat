import { vars } from '../state';

export function resolveVars(s: string): string {
  return String(s).replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? '{{' + k + '}}');
}

export function getPath(obj: unknown, path: string): unknown {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').replace(/\[\*\]/g, '.*').split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (part === '*') {
      return Array.isArray(cur) ? cur : Object.values(cur as Record<string, unknown>);
    }
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}
