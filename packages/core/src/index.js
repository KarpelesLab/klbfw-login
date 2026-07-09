// @karpeleslab/klb-login-core — public API.
//
// Framework-agnostic User Flow v2 login engine + renderer. Designed to be served
// from a CDN and dynamically imported by host adapters (e.g. the Vue plugin), so
// that new authentication mechanisms shipped here reach every site without a
// redeploy.
//
//   mount(element, opts)  -> { destroy, start, controller }
//   createFlow(opts)      -> headless controller (no DOM)
//   registerFieldType(name, spec)  -> extend the field registry
//
// `opts` (mount): {
//   rest,                    // REQUIRED (name, verb, params) => Promise  (from klbfw)
//   action = 'login',        // initial flow action
//   session = null,          // resume token (e.g. OAuth callback)
//   locale = 'en-US',
//   translate,               // optional (token, args) => string  (host i18n wins)
//   messages,                // optional { locale: { token: string } } overrides
//   theme,                   // optional { accent: '#..', radius: '8px', ... } CSS vars
//   realmFlags,              // optional realm flags (array or { name: true } map,
//                            //   e.g. klbfw getRealm().Flags) — drives oauth_first
//   renderers,               // optional { [fieldType]: spec|renderFn } overrides
//   slots,                   // optional { header, footer } Node | string(HTML) | fn(ctx)
//   onComplete(result),      // { user, token, redirect, data }
//   onError(err),
//   onStateChange(state),
//   onRedirect(url),         // default: window.location.href = url
// }

import { createFlow } from './flow.js';
import { createTranslator } from './i18n.js';
import { createRenderer } from './render/renderer.js';
import { registerFieldType } from './render/registry.js';

export const version = '1.0.2';

export { createFlow, registerFieldType };

// Apply theme values as `--klb-login-*` custom properties on the root element.
function applyTheme(element, theme) {
  if (!theme) return;
  for (const [key, value] of Object.entries(theme)) {
    if (value == null) continue;
    const prop = key.startsWith('--') ? key : `--klb-login-${key}`;
    element.style.setProperty(prop, value);
  }
}

export function mount(element, opts = {}) {
  if (!element || !element.ownerDocument) {
    throw new Error('mount: a DOM element is required as the first argument');
  }
  if (typeof opts.rest !== 'function') {
    throw new Error('mount: opts.rest (a klbfw-style rest function) is required');
  }

  const t = createTranslator({
    locale: opts.locale || 'en-US',
    translate: opts.translate,
    messages: opts.messages,
  });

  element.classList.add('klb-login');
  applyTheme(element, opts.theme);

  let renderer = null;

  const controller = createFlow({
    rest: opts.rest,
    t,
    onComplete: opts.onComplete || (() => {}),
    onError: opts.onError || (() => {}),
    onRedirect: opts.onRedirect,
    onStateChange: (state) => {
      if (renderer) renderer.render();
      if (opts.onStateChange) opts.onStateChange(state);
    },
  });

  renderer = createRenderer(element, controller, opts, t);
  renderer.render(); // paint the initial "loading" state immediately

  // Kick off: resume from a session (OAuth callback) or start a fresh flow.
  if (opts.session) {
    controller.resume(opts.session);
  } else {
    controller.start(opts.action || 'login');
  }

  return {
    controller,
    start: (action) => controller.start(action),
    destroy() {
      controller.destroy();
      if (renderer) renderer.destroy();
    },
  };
}

export default { mount, createFlow, registerFieldType, version };
