// Registers the built-in field specs. Imported for its side effects by the
// renderer entry so the registry is populated before the first mount.

import { registerFieldType } from '../registry.js';
import { labelSpec } from './label.js';
import { inputSpec } from './input.js';
import { oauth2Spec } from './oauth2.js';
import { passkeySpec } from './passkey.js';

let registered = false;

export function registerBuiltins() {
  if (registered) return;
  registered = true;
  // Order is not significant among these — each matches a disjoint field shape.
  // (Later registrations, e.g. host overrides, still take precedence.)
  registerFieldType('label', labelSpec);
  registerFieldType('input', inputSpec);
  registerFieldType('oauth2', oauth2Spec);
  registerFieldType('passkey', passkeySpec);
}
