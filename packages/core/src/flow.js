// FlowController — the headless User Flow v2 state machine.
//
// It owns the session token, the current action, and the per-step form values,
// and exposes the operations the renderer drives: start / resume / submit /
// oauth / submitKeyed / switchAction. All protocol knowledge (User:flow calls,
// response normalization, complete/redirect handling, `@action=` switching)
// lives here so the renderer stays purely presentational and so alternative
// hosts can use the controller without any DOM.
//
// Ported and generalized from atonline-console's AuthFlow.vue.

import { flowCall, formatError } from './transport.js';

// Status values surfaced through onStateChange:
//   'loading'     — a flow step is being fetched (initial / switch)
//   'ready'       — a step is rendered and awaiting user input
//   'submitting'  — a submission is in flight
//   'redirecting' — leaving the page (oauth provider / final redirect)
//   'complete'    — flow finished successfully
//   'error'       — the last operation failed (error string is set)

export function createFlow(options = {}) {
  const {
    rest,
    t = (k) => k,
    onComplete = () => {},
    onError = () => {},
    onStateChange = () => {},
    // Default redirect just navigates; hosts can intercept (e.g. SPA router).
    onRedirect = (url) => {
      if (typeof window !== 'undefined') window.location.href = url;
    },
  } = options;

  if (typeof rest !== 'function') {
    throw new Error('createFlow: a `rest(name, verb, params)` function is required');
  }

  const state = {
    status: 'loading',
    action: 'login',
    flowData: null,
    session: '',
    error: null,
    // Live form values for the current step. Persisted across steps for `email`
    // so later steps (password, otp) still know the identifier.
    values: {},
  };

  let destroyed = false;

  const snapshot = () => ({
    status: state.status,
    action: state.action,
    flowData: state.flowData,
    session: state.session,
    error: state.error,
    values: state.values,
  });

  const notify = () => {
    if (destroyed) return;
    onStateChange(snapshot());
  };

  const setStatus = (status, error = null) => {
    state.status = status;
    state.error = error;
    notify();
  };

  // Drop transient values between steps, optionally keeping the identifier.
  const resetValues = ({ keepEmail = true } = {}) => {
    const email = state.values.email;
    state.values = {};
    if (keepEmail && email) state.values.email = email;
  };

  const setValue = (name, value) => {
    state.values[name] = value;
  };

  // Advance the flow with a fresh `data` payload from the server.
  const applyData = (data) => {
    // Provider / final redirect: hand off and stop.
    if (data && data.url) {
      setStatus('redirecting');
      onRedirect(data.url);
      return;
    }

    state.flowData = data;
    state.session = data.session || state.session;

    resetValues({ keepEmail: true });
    if (data.email) state.values.email = data.email;

    if (data.complete) {
      setStatus('complete');
      onComplete({
        user: data.user || null,
        token: data.Token || null,
        redirect: data.Redirect || null,
        data,
      });
      return;
    }

    setStatus('ready');
  };

  // Shared wrapper: run a User:flow call, apply the result, format failures.
  const run = async (params, { status = 'submitting' } = {}) => {
    if (destroyed) return;
    setStatus(status);
    try {
      const data = await flowCall(rest, params);
      if (destroyed) return;
      applyData(data);
    } catch (err) {
      if (destroyed) return;
      onError(err);
      setStatus('error', formatError(err, t));
    }
  };

  // Public operations ------------------------------------------------------

  // Begin a flow for `action` (login/register/reset_password/…), discarding any
  // prior session/values.
  const start = (action = 'login') => {
    state.action = action;
    state.session = '';
    state.flowData = null;
    state.values = {};
    return run({ action, v2: true }, { status: 'loading' });
  };

  // Resume a flow from a session token (e.g. returning from an OAuth redirect).
  const resume = (session) => {
    state.session = session;
    return run({ session }, { status: 'loading' });
  };

  // Submit the current step's collected values (plus any extra keyed values).
  const submit = (extra = {}) => run({ session: state.session, ...state.values, ...extra });

  // Submit a single named key (passkey assertion/attestation, or any custom
  // one-shot field) alongside the session, without the accumulated form values.
  const submitKeyed = (key, value) => run({ session: state.session, [key]: value });

  // Kick off an OAuth2 provider handshake; the response carries a `url` to the
  // provider which applyData() follows.
  const oauth = (providerId) => run({ session: state.session, oauth2: providerId });

  // Switch to a different flow action in place (used by `@action=` links).
  const switchAction = (action) => start(action);

  return {
    getState: snapshot,
    setValue,
    resetValues,
    start,
    resume,
    submit,
    submitKeyed,
    oauth,
    switchAction,
    destroy() {
      destroyed = true;
    },
  };
}
