// Passkey field — WebAuthn login (assertion) and registration (attestation).
//
// Renders a button that triggers the browser ceremony and submits the packed
// result under the key the server designated (`submit_as` for assertions,
// `submit_register_as` for attestations). Login fields also arm conditional
// mediation on step-enter so saved passkeys surface inside the email field's
// autofill menu (see autofill.js / inputAutocomplete for the paired
// `autocomplete="username webauthn"`).

import { el } from '../dom.js';
import {
  isPasskeySupported,
  isConditionalMediationAvailable,
  isPasskeyRegistration,
  isPasskeyCancellation,
  authenticatePasskey,
  registerPasskey,
} from '../../passkey.js';

export const passkeySpec = {
  match: (field) => field.type === 'passkey' || field.type === 'passkey_register',

  render(field, ctx) {
    if (!isPasskeySupported()) return null;

    const registration = isPasskeyRegistration(field);
    const label = registration ? ctx.t('passkey_register_button') : ctx.t('passkey_button');

    const onClick = async () => {
      try {
        if (registration) {
          const cred = await registerPasskey(field);
          if (cred) {
            const key = field.submit_register_as || field.submit_as || 'passkey_create';
            ctx.controller.submitKeyed(key, cred);
          }
        } else {
          const cred = await authenticatePasskey(field, { mediation: 'optional' });
          if (cred) {
            ctx.controller.submitKeyed(field.submit_as || 'passkey', cred);
          }
        }
      } catch (err) {
        if (isPasskeyCancellation(err)) return; // user dismissed — ignore
        ctx.setError(ctx.t('auth_failed'));
      }
    };

    return el(
      'button',
      { type: 'button', class: 'klb-login__button klb-login__button--passkey', on: { click: onClick } },
      [passkeyIcon(), el('span', {}, label)],
    );
  },

  // Arm conditional autofill for login (assertion) fields. Resolves only when
  // the user picks a passkey from the autofill menu; typing an email instead
  // leaves it pending until aborted on step change / destroy.
  onStepEnter(field, ctx) {
    if (isPasskeyRegistration(field) || !isPasskeySupported()) return undefined;

    const controller = new AbortController();
    let aborted = false;

    (async () => {
      if (!(await isConditionalMediationAvailable())) return;
      if (aborted) return;
      try {
        const cred = await authenticatePasskey(field, {
          mediation: 'conditional',
          signal: controller.signal,
        });
        if (cred && !aborted) ctx.controller.submitKeyed(field.submit_as || 'passkey', cred);
      } catch (err) {
        if (!isPasskeyCancellation(err)) console.error('Conditional passkey error:', err);
      }
    })();

    return () => {
      aborted = true;
      controller.abort();
    };
  },
};

function passkeyIcon() {
  // Simple inline key glyph so the button needs no external asset.
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    'M14 6a4 4 0 1 0-3.5 3.97V11l-1 1 1 1-1 1 1 1-1.2 1.2 1.7 1.8V10A4 4 0 0 0 14 6Zm-4-2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z',
  );
  svg.appendChild(path);
  return svg;
}
