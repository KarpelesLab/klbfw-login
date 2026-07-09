// WebAuthn / passkey helpers for the User:flow authentication flow.
//
// The flow API exposes passkeys through `{ cat: "special", type: "passkey" }`
// (login/assertion) and `{ cat: "special", type: "passkey_register" }`
// (registration/attestation) fields — see the userflow.md integration doc. This
// module turns those fields into the browser `navigator.credentials.{get,create}`
// calls and packs the results into the shape the server expects on the next flow
// tick.
//
// Encoding rules (per the doc): challenge and binary response buffers are
// standard base64, while credential ids and user handles are base64url.

// Decode a base64 or base64url string into a Uint8Array.
function decodeBase64(str) {
  // Tolerate base64url input by normalising to standard base64.
  let s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4 !== 0) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Encode an ArrayBuffer / TypedArray into standard base64 (with padding).
function encodeBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// Encode an ArrayBuffer / TypedArray into base64url (no padding).
function encodeBase64url(buf) {
  return encodeBase64(buf)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// True when the browser can perform WebAuthn ceremonies at all.
export function isPasskeySupported() {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!(navigator.credentials && navigator.credentials.get)
  );
}

// True when the browser supports conditional mediation (passkey autofill).
export async function isConditionalMediationAvailable() {
  try {
    return (
      isPasskeySupported() &&
      typeof window.PublicKeyCredential.isConditionalMediationAvailable === 'function' &&
      (await window.PublicKeyCredential.isConditionalMediationAvailable())
    );
  } catch {
    return false;
  }
}

// A passkey field is a registration (attestation) request when it carries the
// parameters that navigator.credentials.create() needs, or when its type is the
// dedicated `passkey_register` variant. Login (assertion) fields only carry a
// challenge and rp_id.
export function isPasskeyRegistration(field) {
  return !!(
    field &&
    (field.type === 'passkey_register' || field.user || field.pubKeyCredParams)
  );
}

// True when an error means the user dismissed / cancelled the native prompt (or
// no eligible credential was offered), as opposed to a real failure.
export function isPasskeyCancellation(err) {
  return (
    !!err &&
    (err.name === 'NotAllowedError' ||
      err.name === 'AbortError' ||
      err.name === 'InvalidStateError')
  );
}

// Build the publicKey options for an assertion (login).
function buildGetOptions(field) {
  return {
    challenge: decodeBase64(field.challenge),
    rpId: field.rp_id,
    allowCredentials: [], // discoverable credentials
    userVerification: 'required',
    timeout: field.timeout,
  };
}

// Pack a credential assertion into the flow submission body.
function packAssertion(cred, field) {
  const r = cred.response;
  return {
    challenge: field.challenge, // echoed back so the server can match the TempVal
    id: encodeBase64url(cred.rawId),
    authenticatorData: encodeBase64(r.authenticatorData),
    clientDataJSON: encodeBase64(r.clientDataJSON),
    signature: encodeBase64(r.signature),
    userHandle: r.userHandle ? encodeBase64url(r.userHandle) : null,
  };
}

// Perform a passkey assertion (login). `mediation` may be "optional" (modal,
// button-triggered) or "conditional" (autofill). `signal` lets the caller abort
// a pending conditional request. Resolves to the packed body, or null if the
// ceremony produced no credential.
export async function authenticatePasskey(field, { mediation = 'optional', signal } = {}) {
  const cred = await navigator.credentials.get({
    publicKey: buildGetOptions(field),
    mediation,
    signal,
  });
  if (!cred) return null;
  return packAssertion(cred, field);
}

// Build the publicKey options for an attestation (registration).
function buildCreateOptions(field) {
  const user = field.user || {};
  return {
    challenge: decodeBase64(field.challenge),
    rp: { id: field.rp_id, name: field.rp_name },
    user: {
      id: decodeBase64(user.id),
      name: user.name,
      displayName: user.displayName || user.name,
    },
    pubKeyCredParams: field.pubKeyCredParams || [
      { type: 'public-key', alg: -7 }, // ES256
      { type: 'public-key', alg: -257 }, // RS256
    ],
    authenticatorSelection: field.authenticatorSelection || { userVerification: 'required' },
    attestation: field.attestation || 'none',
    timeout: field.timeout,
  };
}

// Pack a credential attestation into the flow submission body.
function packAttestation(cred) {
  const r = cred.response;
  return {
    id: encodeBase64url(cred.rawId),
    clientDataJSON: encodeBase64(r.clientDataJSON),
    attestationObject: encodeBase64(r.attestationObject),
  };
}

// Perform a passkey attestation (registration / enrollment).
export async function registerPasskey(field) {
  const cred = await navigator.credentials.create({
    publicKey: buildCreateOptions(field),
  });
  if (!cred) return null;
  return packAttestation(cred);
}
