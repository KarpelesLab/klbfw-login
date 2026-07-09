// Field grouping + password-manager / autofill heuristics, ported from
// atonline-console's AuthFlow.vue. These are pure helpers the renderer consults
// while building a step; the browser-facing tricks (hidden username/password
// fields, current- vs new-password hints, WebAuthn conditional autofill) all
// derive from them.

import { isPasskeyRegistration } from '../passkey.js';

const NEW_PASSWORD_ACTIONS = ['register', 'reset_password', 'recover_account'];

// Split a step's fields into the buckets the renderer lays out separately.
export function groupFields(flowData) {
  const fields = (flowData && flowData.fields) || [];
  return {
    labels: fields.filter((f) => f.type === 'label' || f.cat === 'label'),
    inputs: fields.filter((f) => f.cat === 'input'),
    oauth: fields.filter((f) => f.type === 'oauth2'),
    passkey: fields.filter((f) => f.type === 'passkey' || f.type === 'passkey_register'),
    // "special" excludes passkeys (handled on their own) — e.g. image uploads.
    special: fields.filter(
      (f) => f.cat === 'special' && f.type !== 'passkey' && f.type !== 'passkey_register',
    ),
  };
}

// The login (assertion) passkey field for the step, if any — drives conditional
// autofill and decorates the identifier input's autocomplete.
export function passkeyLoginField(groups) {
  return groups.passkey.find((f) => !isPasskeyRegistration(f)) || null;
}

// The registration (attestation) passkey field for the step, if any.
export function passkeyRegisterField(groups) {
  return groups.passkey.find((f) => isPasskeyRegistration(f)) || null;
}

export function isEmailField(field) {
  return field.type === 'email' || field.name === 'email' || field.name === 'login';
}

export function hasIdentifierInput(groups) {
  return groups.inputs.some(isEmailField);
}

export function isPasswordStep(groups) {
  return groups.inputs.some((f) => f.type === 'password');
}

// Whether the password field(s) represent a *new* password (registration /
// reset, or paired with a confirmation field) vs an existing one being entered.
export function isNewPasswordStep(groups, action) {
  const pw = groups.inputs.filter((f) => f.type === 'password');
  if (pw.length > 1) return true;
  if (pw.some((f) => f.validation?.type === 'equal_other_field')) return true;
  return NEW_PASSWORD_ACTIONS.includes(action);
}

export function knownEmail(values, flowData) {
  return (values && values.email) || (flowData && flowData.email) || '';
}

// A hidden username field is injected on password steps that no longer render an
// email input, so the browser can pair the password with the identifier.
export function showHiddenIdentifier(groups, values, flowData) {
  return isPasswordStep(groups) && !hasIdentifierInput(groups) && !!knownEmail(values, flowData);
}

// A hidden password field is injected on the identifier step so native autofill
// can fill the saved password; it is captured and replayed on the later
// password step.
export function showHiddenPassword(groups) {
  return hasIdentifierInput(groups) && !isPasswordStep(groups);
}

// Compute the autocomplete hint for an input, providing sensible defaults the
// server rarely sends and opting the identifier into WebAuthn conditional
// autofill when a passkey login field is present.
export function inputAutocomplete(field, ctx) {
  const base = field.attributes?.autocomplete;

  if (isEmailField(field)) {
    const value = base || 'username';
    return ctx.passkeySupported && ctx.passkeyLoginField ? `${value} webauthn` : value;
  }
  if (base) return base;
  if (field.type === 'password') {
    return ctx.isNewPasswordStep ? 'new-password' : 'current-password';
  }
  if (field.name === 'otp' || field.name === 'code') return 'one-time-code';
  return undefined;
}
