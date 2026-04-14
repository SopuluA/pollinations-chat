import type { NodeType, NodeConfig } from '../types';

export interface NodeDef {
  label: string;
  icon: string;
  color: string;
  hasIn: boolean;
  hasOut: boolean;
}

export const NODE_DEF: Record<NodeType, NodeDef> = {
  trigger:   { label: 'Trigger',       icon: '⚡', color: '#5b8dee', hasIn: false, hasOut: true  },
  request:   { label: 'HTTP Request',  icon: '🌐', color: '#22c55e', hasIn: true,  hasOut: true  },
  auth:      { label: 'Auth',          icon: '🔑', color: '#eab308', hasIn: true,  hasOut: true  },
  paginate:  { label: 'Paginate',      icon: '📄', color: '#f97316', hasIn: true,  hasOut: true  },
  extract:   { label: 'Extract',       icon: '🔍', color: '#3b82f6', hasIn: true,  hasOut: true  },
  transform: { label: 'Transform',     icon: '⚙',  color: '#f97316', hasIn: true,  hasOut: true  },
  set_var:   { label: 'Set Variable',  icon: '📌', color: '#a855f7', hasIn: true,  hasOut: true  },
  condition: { label: 'Condition',     icon: '🔀', color: '#eab308', hasIn: true,  hasOut: true  },
  ai:        { label: 'AI Process',    icon: '🤖', color: '#a855f7', hasIn: true,  hasOut: true  },
  output:    { label: 'Output',        icon: '📤', color: '#6b7280', hasIn: true,  hasOut: false },
};

export const DEFAULTS: Record<NodeType, NodeConfig> = {
  trigger:   { input: '' },
  request:   { method: 'GET', url: '', headers: [], body: '', auth_type: 'none', auth_value: '' },
  auth:      { type: 'bearer', value: '' },
  paginate:  { page_param: 'page', start: 1, max_pages: 5 },
  extract:   { path: '', save_as: '' },
  transform: { template: '{{input}}' },
  set_var:   { name: '', value: '{{input}}' },
  condition: { field: 'status', op: 'eq', val: '200' },
  ai:        { system: 'You are a helpful assistant. Be concise.', prompt: 'Summarize this data:\n\n{{input}}' },
  output:    { label: 'Result', format: 'auto' },
};
