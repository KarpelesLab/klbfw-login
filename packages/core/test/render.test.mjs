// DOM renderer tests under jsdom.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let mount;

before(async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    pretendToBeVisual: true,
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  // Mock enough WebAuthn so isPasskeySupported() is true and passkey rendering
  // is exercised. Conditional mediation is reported unavailable so onStepEnter
  // never fires a real credentials.get().
  dom.window.PublicKeyCredential = function PublicKeyCredential() {};
  dom.window.PublicKeyCredential.isConditionalMediationAvailable = async () => false;
  const credentials = { get: async () => null, create: async () => null };
  // `navigator` is a getter-only global in modern Node; redefine it (and its
  // credentials) so the module sees WebAuthn support.
  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: dom.window.navigator,
      configurable: true,
      writable: true,
    });
  } catch {
    /* fall back to Node's navigator below */
  }
  try {
    Object.defineProperty(globalThis.navigator, 'credentials', {
      value: credentials,
      configurable: true,
    });
  } catch {
    /* if navigator can't be augmented, passkey-rendering assertions are skipped */
  }

  ({ mount } = await import('../src/index.js'));
});

const ok = (data) => Promise.resolve({ result: 'success', data });

function scriptedRest() {
  let step = 0;
  return (name, verb, params) => {
    if (params.action) {
      step = 1;
      return ok({
        initial: true, session: 's1', message: 'Sign in', req: ['email'],
        fields: [
          { cat: 'label', type: 'label', label: 'Welcome' },
          { cat: 'input', name: 'email', type: 'email', label: 'Email' },
          { cat: 'label', type: 'label', label: 'Forgot?', link: '@action=reset_password', linkText: 'Forgot?' },
          { type: 'oauth2', id: 'google', info: { Token_Name: 'google', Name: 'Google' }, button: { 'background-color': '#4285F4' } },
        ],
      });
    }
    if (step === 1) {
      step = 2;
      return ok({ session: 's2', req: ['password'],
        fields: [{ cat: 'input', name: 'password', type: 'password', label: 'Password' }] });
    }
    return ok({ complete: true, user: { Email: 'a@b.c' }, Redirect: '/dash', Token: 'tok' });
  };
}

const tick = () => new Promise((r) => setTimeout(r, 10));

test('renders the identifier step with themed vars, oauth button, and @action link', async () => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const inst = mount(el, { rest: scriptedRest(), theme: { accent: '#6c5ce7' } });
  await tick();

  assert.ok(el.classList.contains('klb-login'));
  assert.equal(el.style.getPropertyValue('--klb-login-accent'), '#6c5ce7');
  assert.ok(document.getElementById('klb-login-core-styles'), 'stylesheet injected');

  const email = el.querySelector('input[type=email]');
  assert.ok(email, 'email input present');
  assert.equal(email.getAttribute('autocomplete'), 'username');

  const oauth = el.querySelector('.klb-login__oauth-button');
  assert.ok(oauth, 'oauth button present');
  assert.match(oauth.style.backgroundColor, /66,\s*133,\s*244|#4285F4/i);

  const link = el.querySelector('.klb-login__link');
  assert.equal(link.textContent, 'Forgot?');
  assert.equal(link.getAttribute('href'), '#'); // @action links don't navigate

  assert.equal(el.querySelector('.klb-login__button--primary').textContent, 'Continue');
  inst.destroy();
});

test('advances to the password step with a hidden username and completes', async () => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  let completed = null;
  const inst = mount(el, { rest: scriptedRest(), onComplete: (r) => { completed = r; } });
  await tick();

  const email = el.querySelector('input[type=email]');
  email.value = 'a@b.c';
  email.dispatchEvent(new window.Event('input'));
  el.querySelector('form').dispatchEvent(new window.Event('submit'));
  await tick();

  assert.ok(el.querySelector('input[name=username].klb-login__hidden'), 'hidden username for password managers');
  assert.equal(el.querySelector('input[type=password]').getAttribute('autocomplete'), 'current-password');
  assert.equal(el.querySelector('.klb-login__button--primary').textContent, 'Sign In');
  assert.ok(el.querySelector('.klb-login__button--secondary'), 'back button on non-initial step');

  const pw = el.querySelector('input[type=password]');
  pw.value = 'pw';
  pw.dispatchEvent(new window.Event('input'));
  el.querySelector('form').dispatchEvent(new window.Event('submit'));
  await tick();

  assert.ok(completed, 'onComplete fired');
  assert.equal(completed.redirect, '/dash');
  inst.destroy();
});

test('passkey assertion button shows on the initial step but not on later steps', async () => {
  let step = 0;
  const passkeyField = {
    cat: 'special', type: 'passkey', rp_id: 'x', challenge: 'AAAA', submit_as: 'passkey',
  };
  const rest = (name, verb, params) => {
    if (params.action) {
      step = 1;
      return ok({
        initial: true, session: 's1', req: ['email'],
        fields: [{ cat: 'input', name: 'email', type: 'email', label: 'Email' }, passkeyField],
      });
    }
    // Non-initial step that still carries the passkey field alongside a code input.
    return ok({
      session: 's2', req: ['code'],
      fields: [{ cat: 'input', name: 'code', type: 'text', label: 'Verification code' }, passkeyField],
    });
  };

  const el = document.createElement('div');
  document.body.appendChild(el);
  const inst = mount(el, { rest });
  await tick();
  assert.ok(el.querySelector('.klb-login__button--passkey'), 'passkey button on initial step');

  const email = el.querySelector('input[type=email]');
  email.value = 'a@b.c';
  email.dispatchEvent(new window.Event('input'));
  el.querySelector('form').dispatchEvent(new window.Event('submit'));
  await tick();

  assert.ok(el.querySelector('input#code'), 'reached the verification-code step');
  assert.equal(el.querySelector('.klb-login__button--passkey'), null, 'no passkey button on the code step');
  inst.destroy();
});

test('oauth_first realm flag renders OAuth above the form', async () => {
  const rest = () =>
    ok({
      initial: true, session: 's1', req: ['email'],
      fields: [
        { cat: 'input', name: 'email', type: 'email', label: 'Email' },
        { type: 'oauth2', id: 'google', info: { Token_Name: 'google' }, button: {} },
      ],
    });

  // Default: OAuth sits after the email input.
  const a = document.createElement('div'); document.body.appendChild(a);
  const ia = mount(a, { rest });
  await tick();
  let nodes = [...a.querySelectorAll('input[type=email], .klb-login__oauth')];
  assert.equal(nodes[0].tagName, 'INPUT', 'default: email before oauth');
  assert.ok(nodes[1].classList.contains('klb-login__oauth'));
  ia.destroy();

  // oauth_first (object-map form, like klbfw getRealm().Flags): OAuth first.
  const b = document.createElement('div'); document.body.appendChild(b);
  const ib = mount(b, { rest, realmFlags: { oauth_first: true } });
  await tick();
  nodes = [...b.querySelectorAll('input[type=email], .klb-login__oauth')];
  assert.ok(nodes[0].classList.contains('klb-login__oauth'), 'oauth_first: oauth before email');
  assert.equal(nodes[1].tagName, 'INPUT');
  ib.destroy();

  // Array form (like a flow response's realm_flags) works too.
  const c = document.createElement('div'); document.body.appendChild(c);
  const ic = mount(c, { rest, realmFlags: ['oauth_first'] });
  await tick();
  nodes = [...c.querySelectorAll('input[type=email], .klb-login__oauth')];
  assert.ok(nodes[0].classList.contains('klb-login__oauth'), 'array flag form also puts oauth first');
  ic.destroy();
});

test('client-side validation blocks submit when a required field is empty', async () => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  let calls = 0;
  const rest = (name, verb, params) => {
    calls += 1;
    return ok({ initial: true, session: 's1', req: ['email'],
      fields: [{ cat: 'input', name: 'email', type: 'email', label: 'Email' }] });
  };
  const inst = mount(el, { rest });
  await tick();
  const callsAfterStart = calls;

  el.querySelector('form').dispatchEvent(new window.Event('submit')); // email empty
  await tick();

  assert.equal(calls, callsAfterStart, 'no network call while required field is empty');
  assert.ok(el.querySelector('.klb-login__error'), 'validation error shown');
  inst.destroy();
});
