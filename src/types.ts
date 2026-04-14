export type NodeType =
  | 'trigger'
  | 'request'
  | 'auth'
  | 'paginate'
  | 'extract'
  | 'transform'
  | 'set_var'
  | 'condition'
  | 'ai'
  | 'output';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

export interface KVPair {
  k: string;
  v: string;
}

export interface NodeConfig {
  // trigger
  input?: string;
  // request
  method?: HttpMethod;
  url?: string;
  headers?: KVPair[];
  body?: string;
  auth_type?: 'none' | 'bearer' | 'api_key' | 'basic';
  auth_value?: string;
  auth_key?: string;
  // auth node
  type?: 'bearer' | 'api_key' | 'basic';
  value?: string;
  // paginate
  page_param?: string;
  start?: number;
  max_pages?: number;
  // extract
  path?: string;
  save_as?: string;
  // transform
  template?: string;
  // set_var
  name?: string;
  // condition
  field?: 'status' | 'body' | 'header';
  op?: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'starts_with';
  val?: string;
  header_name?: string;
  // ai
  system?: string;
  prompt?: string;
  // output
  label?: string;
  format?: 'auto' | 'json' | 'text';
}

export interface FlowNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  label: string;
  config: NodeConfig;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
}

export interface HttpCtx {
  status: number;
  headers: Record<string, string>;
  body: string;
  ms: number;
}

export interface ExecResult {
  text: string;
  httpCtx?: HttpCtx;
}
