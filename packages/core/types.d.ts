// Type definitions for @karpeleslab/klb-login-core

export type RestFn = (name: string, verb: string, params?: any, context?: any) => Promise<any>;
export type TranslateFn = (token: string, args?: Record<string, any>) => string;

export interface FlowState {
  status: 'loading' | 'ready' | 'submitting' | 'redirecting' | 'complete' | 'error';
  action: string;
  flowData: any | null;
  session: string;
  error: string | null;
  values: Record<string, any>;
}

export interface CompleteResult {
  user: any | null;
  token: string | null;
  redirect: string | null;
  data: any;
}

export interface FieldContext {
  t: TranslateFn;
  rest?: RestFn;
  controller: FlowController;
  flowData: any;
  values: Record<string, any>;
  setValue(name: string, value: any): void;
  required(name: string): boolean;
  autocomplete(field: any): string | undefined;
  isFocusTarget(field: any): boolean;
  passkeySupported: boolean;
  passkeyLoginField: any | null;
  hasFlag(name: string): boolean;
  setError(message: string): void;
}

export interface FieldSpec {
  match(field: any): boolean;
  render(field: any, ctx: FieldContext): Node | null;
  onStepEnter?(field: any, ctx: FieldContext): void | (() => void);
}

export interface FlowController {
  getState(): FlowState;
  setValue(name: string, value: any): void;
  resetValues(opts?: { keepEmail?: boolean }): void;
  start(action?: string): Promise<void>;
  resume(session: string): Promise<void>;
  submit(extra?: Record<string, any>): Promise<void>;
  submitKeyed(key: string, value: any): Promise<void>;
  oauth(providerId: string): Promise<void>;
  switchAction(action: string): Promise<void>;
  destroy(): void;
}

export interface MountOptions {
  rest: RestFn;
  action?: string;
  session?: string | null;
  locale?: string;
  translate?: TranslateFn;
  messages?: Record<string, Record<string, string>>;
  theme?: Record<string, string>;
  realmFlags?: string[] | Record<string, boolean>;
  renderers?: Record<string, FieldSpec | ((field: any, ctx: FieldContext) => Node | null)>;
  slots?: { header?: any; footer?: any };
  onComplete?(result: CompleteResult): void;
  onError?(error: any): void;
  onStateChange?(state: FlowState): void;
  onRedirect?(url: string): void;
}

export interface MountInstance {
  controller: FlowController;
  start(action: string): Promise<void>;
  destroy(): void;
}

export interface CreateFlowOptions {
  rest: RestFn;
  t?: TranslateFn;
  onComplete?(result: CompleteResult): void;
  onError?(error: any): void;
  onStateChange?(state: FlowState): void;
  onRedirect?(url: string): void;
}

export const version: string;
export function mount(element: HTMLElement, opts: MountOptions): MountInstance;
export function createFlow(opts: CreateFlowOptions): FlowController;
export function registerFieldType(name: string, spec: FieldSpec): () => void;

declare const _default: {
  mount: typeof mount;
  createFlow: typeof createFlow;
  registerFieldType: typeof registerFieldType;
  version: string;
};
export default _default;
