import type { FlowNode, Edge, HttpCtx } from './types';

export const nodes: FlowNode[] = [];
export const edges: Edge[] = [];
export const vars: Record<string, string> = {};
export const nodeResponses: Record<string, HttpCtx> = {};

export let selected: string | null = null;
export let connecting: { nodeId: string; x: number; y: number } | null = null;
export let dragging: { nodeId: string; offX: number; offY: number } | null = null;
export let running = false;
export let idSeq = 1;

export function setSelected(v: string | null) { selected = v; }
export function setConnecting(v: typeof connecting) { connecting = v; }
export function setDragging(v: typeof dragging) { dragging = v; }
export function setRunning(v: boolean) { running = v; }
export function nextId() { return 'n' + (idSeq++); }
export function setIdSeq(v: number) { idSeq = v; }

export function resetState() {
  nodes.length = 0;
  edges.length = 0;
  for (const k of Object.keys(vars)) delete vars[k];
  for (const k of Object.keys(nodeResponses)) delete nodeResponses[k];
  selected = null;
  connecting = null;
  dragging = null;
  running = false;
  idSeq = 1;
}
