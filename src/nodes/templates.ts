import type { FlowNode, Edge } from '../types';

export interface WorkflowTemplate {
  name: string;
  description: string;
  nodes: Omit<FlowNode, 'id'>[];
  edges: { from: number; to: number }[]; // indices into nodes array
}

export const TEMPLATES: WorkflowTemplate[] = [
  {
    name: 'Fetch & Summarize',
    description: 'GET a public API and AI-summarize the response',
    nodes: [
      { type: 'trigger',  x: 100, y: 80,  label: 'Start', config: { input: 'Fetch posts' } },
      { type: 'request',  x: 100, y: 200, label: 'Fetch URL', config: { method: 'GET', url: 'https://jsonplaceholder.typicode.com/posts?_limit=5', headers: [], body: '', auth_type: 'none', auth_value: '' } },
      { type: 'ai',       x: 100, y: 320, label: 'AI', config: { system: 'You are a helpful assistant.', prompt: 'Summarize these posts in 3 bullet points:\n\n{{input}}' } },
      { type: 'output',   x: 100, y: 440, label: 'Result', config: { label: 'Summary', format: 'auto' } },
    ],
    edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }],
  },
  {
    name: 'Auth + POST',
    description: 'Bearer token auth into a POST request with condition gate',
    nodes: [
      { type: 'trigger',   x: 100, y: 80,  label: 'Start', config: { input: '{"name":"test"}' } },
      { type: 'auth',      x: 300, y: 80,  label: 'Auth', config: { type: 'bearer', value: 'YOUR_TOKEN' } },
      { type: 'request',   x: 100, y: 220, label: 'POST request', config: { method: 'POST', url: 'https://jsonplaceholder.typicode.com/posts', headers: [], body: '{{input}}', auth_type: 'none', auth_value: '' } },
      { type: 'condition', x: 100, y: 360, label: 'Check 201', config: { field: 'status', op: 'eq', val: '201' } },
      { type: 'output',    x: 100, y: 480, label: 'Result', config: { label: 'Created', format: 'json' } },
    ],
    edges: [{ from: 0, to: 2 }, { from: 1, to: 2 }, { from: 2, to: 3 }, { from: 3, to: 4 }],
  },
  {
    name: 'Extract Field',
    description: 'Fetch JSON, pick a field, save as variable',
    nodes: [
      { type: 'trigger', x: 100, y: 80,  label: 'Start', config: { input: '' } },
      { type: 'request', x: 100, y: 200, label: 'Fetch user', config: { method: 'GET', url: 'https://jsonplaceholder.typicode.com/users/1', headers: [], body: '', auth_type: 'none', auth_value: '' } },
      { type: 'extract', x: 100, y: 320, label: 'Get email', config: { path: 'email', save_as: 'user_email' } },
      { type: 'output',  x: 100, y: 440, label: 'Email', config: { label: 'User Email', format: 'text' } },
    ],
    edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }],
  },
  {
    name: 'Paginate API',
    description: 'Loop through multiple pages and collect all results',
    nodes: [
      { type: 'trigger',  x: 100, y: 80,  label: 'Start', config: { input: '' } },
      { type: 'request',  x: 100, y: 200, label: 'Fetch page', config: { method: 'GET', url: 'https://jsonplaceholder.typicode.com/posts', headers: [], body: '', auth_type: 'none', auth_value: '' } },
      { type: 'paginate', x: 100, y: 320, label: 'Loop pages', config: { page_param: '_page', start: 1, max_pages: 3 } },
      { type: 'output',   x: 100, y: 440, label: 'All results', config: { label: 'Pages', format: 'json' } },
    ],
    edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }],
  },
];
