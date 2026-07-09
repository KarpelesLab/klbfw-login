// @karpeleslab/klb-login-vue — Vue 3 adapter for the klbfw login core.
//
// Usage:
//   import { KlbLogin } from '@karpeleslab/klb-login-vue';
//   app.use(KlbLogin, { translate: t, theme: { accent: '#6c5ce7' } });
//   // then in a template:
//   <KlbLogin action="login" @success="onSuccess" />
//
// Or import the component directly without installing the plugin.

import KlbLoginComponent from './KlbLogin.vue';
import { KLB_LOGIN_OPTIONS } from './plugin.js';
import { loadCore, DEFAULT_CORE_URL } from './loadCore.js';

// The component doubles as a Vue plugin: `app.use(KlbLogin, options)` registers
// the global <KlbLogin> and stores default options (coreUrl, theme, messages,
// translate, locale) that components read as fallbacks.
KlbLoginComponent.install = (app, options = {}) => {
  app.provide(KLB_LOGIN_OPTIONS, options);
  app.component(KlbLoginComponent.name, KlbLoginComponent);
};

export const KlbLogin = KlbLoginComponent;
export { loadCore, DEFAULT_CORE_URL };
export default KlbLoginComponent;
