// Type definitions for @karpeleslab/klb-login-vue
import type { DefineComponent, Plugin } from 'vue';
import type { CompleteResult, FlowState, MountOptions } from '@karpeleslab/klb-login-core';

export type KlbLoginProps = {
  action?: string;
  coreUrl?: string;
  theme?: Record<string, string>;
  messages?: Record<string, Record<string, string>>;
  renderers?: MountOptions['renderers'];
  locale?: string;
  translate?: (token: string, args?: Record<string, any>) => string;
};

export type KlbLoginEmits = {
  success: (result: CompleteResult) => void;
  error: (error: any) => void;
  'state-change': (state: FlowState) => void;
  redirect: (url: string) => void;
};

export interface KlbLoginPluginOptions {
  coreUrl?: string;
  theme?: Record<string, string>;
  messages?: Record<string, Record<string, string>>;
  translate?: (token: string, args?: Record<string, any>) => string;
  locale?: string;
}

export const KlbLogin: DefineComponent<KlbLoginProps> & Plugin<[KlbLoginPluginOptions?]>;
export const DEFAULT_CORE_URL: string;
export function loadCore(url?: string): Promise<any>;

export default KlbLogin;
