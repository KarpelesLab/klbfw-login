// Registers the built-in field specs. Imported for its side effects by the
// renderer entry so the registry is populated before the first mount.

import { registerFieldType } from '../registry.js';
import { labelSpec } from './label.js';
import { inputSpec } from './input.js';
import { oauth2Spec } from './oauth2.js';
import { passkeySpec } from './passkey.js';
import { otpSpec } from './otp.js';

let registered = false;

export function registerBuiltins() {
  if (registered) return;
  registered = true;
  // Order is not significant among these — each matches a disjoint field shape —
  // except `otp`, a kind of input, which must come after `input` so it is
  // checked first. (Later registrations, e.g. host overrides, take precedence.)
  registerFieldType('label', labelSpec);
  registerFieldType('input', inputSpec);
  registerFieldType('oauth2', oauth2Spec);
  registerFieldType('passkey', passkeySpec);
  registerFieldType('otp', otpSpec);
}
