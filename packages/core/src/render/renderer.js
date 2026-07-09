// Default renderer — turns FlowController state into DOM and wires user input
// back into the controller. It also carries the password-manager tricks and the
// passkey conditional-autofill lifecycle that a plain field-by-field render
// can't express (hidden username/password fields, captured-password replay,
// aborting conditional WebAuthn on step change).
//
// Field bodies come from the registry (render/fields), so new field types added
// to the CDN core render here without any change to this file or to host sites.

import { el, clear } from './dom.js';
import { injectStyles } from '../styles.js';
import { normalizeFlags } from '../realm-flags.js';
import { resolveFieldSpec } from './registry.js';
import { registerBuiltins } from './fields/index.js';
import { isPasskeySupported } from '../passkey.js';
import {
  groupFields,
  passkeyLoginField,
  isPasswordStep,
  isNewPasswordStep,
  inputAutocomplete,
  knownEmail,
  showHiddenIdentifier,
  showHiddenPassword,
} from './autofill.js';

export function createRenderer(element, controller, opts, t) {
  registerBuiltins();
  injectStyles(element.ownerDocument);

  const overrides = opts.renderers || {};
  const slots = opts.slots || {};
  const rest = opts.rest;
  const passkeySupported = isPasskeySupported();

  let stepCleanups = [];
  let lastFlowData = null;
  let pendingPassword = '';
  let localError = null;

  const runCleanups = () => {
    stepCleanups.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
    stepCleanups = [];
  };

  // Build the context handed to every field spec for the current step.
  const buildStepContext = (state, groups) => {
    const pwStep = isPasswordStep(groups);
    const newPwStep = isNewPasswordStep(groups, state.action);
    const loginPasskey = passkeyLoginField(groups);
    const focusName = pwStep
      ? (groups.inputs.find((f) => f.type === 'password') || {}).name
      : (groups.inputs[0] || {}).name;

    return {
      t,
      rest,
      controller,
      flowData: state.flowData,
      groups,
      values: state.values,
      setValue: (name, value) => controller.setValue(name, value),
      required: (name) => Array.isArray(state.flowData.req) && state.flowData.req.includes(name),
      autocomplete: (field) =>
        inputAutocomplete(field, {
          passkeySupported,
          passkeyLoginField: loginPasskey,
          isNewPasswordStep: newPwStep,
        }),
      isFocusTarget: (field) => field.name === focusName,
      passkeySupported,
      passkeyLoginField: loginPasskey,
      // Active realm flags: the klbfw-provided `realmFlags` option (available
      // with no request) unioned with any `realm_flags` on the flow response.
      // Missing → empty set (safe defaults).
      hasFlag: (name) =>
        normalizeFlags(opts.realmFlags, state.flowData && state.flowData.realm_flags).has(name),
      setError: (msg) => {
        localError = msg;
        render();
      },
    };
  };

  // Client-side validation before a submission leaves the browser.
  const validate = (state, groups) => {
    const req = Array.isArray(state.flowData.req) ? state.flowData.req : [];
    const missing = req.filter((name) => {
      const v = state.values[name];
      return v === undefined || v === null || v === '' || v === false;
    });
    if (missing.length) {
      const names = missing
        .map((name) => (groups.inputs.find((f) => f.name === name) || {}).label || name)
        .join(', ');
      return t('fill_required_fields', { fields: names });
    }
    for (const field of groups.inputs) {
      if (field.validation?.type === 'equal_other_field') {
        if (state.values[field.name] !== state.values[field.validation.field]) {
          return t('passwords_do_not_match');
        }
      }
    }
    return null;
  };

  const renderSlot = (slot, ctx) => {
    const value = typeof slot === 'function' ? slot(ctx) : slot;
    if (value == null) return null;
    if (typeof value === 'string') {
      const wrap = el('div', {});
      wrap.innerHTML = value;
      return wrap;
    }
    return value; // assume Node
  };

  const spinner = (label) =>
    el('div', { class: 'klb-login__loading' }, [
      el('div', { class: 'klb-login__spinner' }),
      el('p', {}, label || t('loading')),
    ]);

  // Build the form for a live step (status ready / submitting / inline error).
  const renderStep = (state) => {
    const groups = groupFields(state.flowData);
    const ctx = buildStepContext(state, groups);
    const busy = state.status === 'submitting' || state.status === 'redirecting';
    const pwStep = isPasswordStep(groups);

    const form = el('form', { class: 'klb-login__form' });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      localError = null;
      const err = validate(state, groups);
      if (err) {
        localError = err;
        render();
        return;
      }
      controller.submit();
    });

    // The `oauth_first` realm flag surfaces the OAuth providers above the form.
    const oauthFirst = ctx.hasFlag('oauth_first');

    // Build the OAuth section for a given placement:
    //  - 'top'    (oauth_first): buttons first, then a divider introducing the
    //             email form below (only when a form actually follows).
    //  - 'bottom' (default): a divider ("Or sign in with…") then the buttons.
    const buildOAuth = (position) => {
      if (!groups.oauth.length) return;
      const buttons = el('div', { class: 'klb-login__oauth-buttons' });
      groups.oauth.forEach((f) => appendField(buttons, f, ctx, overrides));
      const divider = (key) =>
        el('div', { class: 'klb-login__oauth-divider' }, el('span', {}, t(key)));
      const children =
        position === 'top'
          ? [buttons, groups.inputs.length ? divider('oauth_first_email_help') : null]
          : [divider('user_oauth_help'), buttons];
      form.appendChild(el('div', { class: 'klb-login__oauth' }, children));
    };

    // Labels (instructions / errors / @action links).
    groups.labels.forEach((f) => appendField(form, f, ctx, overrides));

    // OAuth on top when the realm prefers it.
    if (oauthFirst) buildOAuth('top');

    // Hidden username on password-only steps → password-manager pairing.
    if (showHiddenIdentifier(groups, state.values, state.flowData)) {
      form.appendChild(
        el('input', {
          type: 'text',
          name: 'username',
          autocomplete: 'username',
          value: knownEmail(state.values, state.flowData),
          class: 'klb-login__hidden',
          tabIndex: -1,
          readOnly: true,
          'aria-hidden': 'true',
        }),
      );
    }

    // Inputs.
    groups.inputs.forEach((f) => appendField(form, f, ctx, overrides));

    // Hidden password on the identifier step → capture autofilled secret.
    if (showHiddenPassword(groups)) {
      form.appendChild(
        el('input', {
          type: 'password',
          name: 'password',
          autocomplete: 'current-password',
          class: 'klb-login__hidden',
          tabIndex: -1,
          'aria-hidden': 'true',
          on: { input: (e) => (pendingPassword = e.target.value) },
        }),
      );
    }

    // Passkey + other special fields.
    groups.passkey.forEach((f) => appendField(form, f, ctx, overrides));
    groups.special.forEach((f) => appendField(form, f, ctx, overrides));

    // Inline error (client validation or a failed submission).
    const errorText = localError || (state.status === 'error' ? state.error : null);
    if (errorText) form.appendChild(el('div', { class: 'klb-login__error' }, errorText));

    // Primary submit (only when there is something to submit).
    if (groups.inputs.length > 0) {
      form.appendChild(
        el(
          'button',
          { type: 'submit', class: 'klb-login__button klb-login__button--primary', disabled: busy },
          pwStep ? t('sign_in') : t('continue'),
        ),
      );
    }

    // Back to the start of the flow on non-initial steps.
    if (state.flowData && !state.flowData.initial) {
      form.appendChild(
        el('div', { class: 'klb-login__footer' }, [
          el(
            'button',
            {
              type: 'button',
              class: 'klb-login__button klb-login__button--secondary',
              on: { click: () => controller.switchAction(state.action) },
            },
            t('back'),
          ),
        ]),
      );
    }

    // OAuth at the bottom by default (unless already placed on top).
    if (!oauthFirst) buildOAuth('bottom');

    return { form, ctx, groups, focusable: !busy };
  };

  // Append a field via its registry spec, collecting any step-enter cleanup.
  function appendField(parent, field, ctx, overridesMap) {
    const spec = resolveFieldSpec(field, overridesMap);
    if (!spec) return; // unknown field type — skip gracefully (forward-compat)
    let node = null;
    try {
      node = spec.render(field, ctx);
    } catch (err) {
      console.error('klb-login: field render failed', field.type, err);
      return;
    }
    if (node) parent.appendChild(node);
    if (typeof spec.onStepEnter === 'function') {
      const cleanup = spec.onStepEnter(field, ctx);
      if (typeof cleanup === 'function') stepCleanups.push(cleanup);
    }
  }

  function render() {
    const state = controller.getState();
    const stepChanged = state.flowData !== lastFlowData;

    // Leaving a step: run its cleanups (abort conditional passkey, etc.).
    if (stepChanged) {
      runCleanups();
      localError = null;
      // Drop a captured password if the flow branched away from password entry.
      if (stepChanged && state.flowData) {
        const groups = groupFields(state.flowData);
        if (pendingPassword && !isPasswordStep(groups)) pendingPassword = '';
      }
    }
    lastFlowData = state.flowData;

    clear(element);
    element.classList.add('klb-login');

    const headerCtx = { t, state };
    const header = renderSlot(slots.header, headerCtx);
    if (header) element.appendChild(header);

    if (state.flowData && (state.status === 'ready' || state.status === 'submitting' || state.status === 'error')) {
      if (state.flowData.message) {
        element.appendChild(el('div', { class: 'klb-login__message' }, t(state.flowData.message)));
      }
      const { form, groups, focusable } = renderStep(state);
      element.appendChild(form);

      // Replay an autofilled password once the single-password step appears.
      if (pendingPassword && isPasswordStep(groups)) {
        const pwFields = groups.inputs.filter((f) => f.type === 'password');
        if (pwFields.length === 1) {
          const pw = pendingPassword;
          pendingPassword = '';
          controller.setValue(pwFields[0].name, pw);
          Promise.resolve().then(() => controller.submit());
        }
      }

      // Focus the primary input for the step.
      if (focusable) {
        const target =
          element.querySelector('[data-klb-autofocus]') ||
          element.querySelector('.klb-login__input, .klb-login__select');
        if (target) target.focus();
      }
    } else if (state.status === 'error') {
      element.appendChild(el('div', { class: 'klb-login__error' }, state.error || t('auth_failed')));
      element.appendChild(
        el(
          'button',
          {
            class: 'klb-login__button klb-login__button--primary',
            style: { marginTop: '1rem' },
            on: { click: () => controller.switchAction(state.action) },
          },
          t('try_again'),
        ),
      );
    } else if (state.status === 'complete' || state.status === 'redirecting') {
      element.appendChild(spinner(t('loading')));
    } else {
      element.appendChild(spinner(t('loading')));
    }

    const footer = renderSlot(slots.footer, headerCtx);
    if (footer) element.appendChild(footer);
  }

  return {
    render,
    destroy() {
      runCleanups();
      clear(element);
    },
  };
}
