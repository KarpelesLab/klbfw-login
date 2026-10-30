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

test('oauth consent step translates [I18N:…] tokens and approves by submitting the session', async () => {
  const calls = [];
  const rest = (name, verb, params) => {
    calls.push(params);
    if (params.session === 's1') return ok({ complete: true, Redirect: '/oauth2_return' });
    return ok({
      complete: false, initial: false, session: 's1', req: [],
      message: '[I18N:user_flow_login_grant]',
      user: { Display_Name: 'Jane Doe', Email: 'jane@example.com' },
      fields: [
        { cat: 'label', type: 'label', label: '[I18N:user_grant_approval]' },
        { cat: 'label', type: 'label', label: 'profile' },
      ],
    });
  };

  const el = document.createElement('div');
  document.body.appendChild(el);
  let completed = null;
  const inst = mount(el, { rest, session: 's0', onComplete: (r) => { completed = r; } });
  await tick();

  assert.equal(el.querySelector('.klb-login__message').textContent, 'Authorize access');
  const labels = [...el.querySelectorAll('.klb-login__text')].map((n) => n.textContent);
  assert.deepEqual(labels, ['This application is requesting access to your account:', 'profile']);

  assert.equal(el.querySelector('.klb-login__user-name').textContent, 'Jane Doe');
  assert.equal(el.querySelector('.klb-login__user-email').textContent, 'jane@example.com');

  const allow = el.querySelector('.klb-login__button--primary');
  assert.ok(allow, 'consent step has a primary button despite having no inputs');
  assert.equal(allow.textContent, 'Allow');
  assert.equal(el.querySelector('.klb-login__button--secondary').textContent, 'Cancel');

  el.querySelector('form').dispatchEvent(new window.Event('submit'));
  await tick();
  assert.deepEqual(calls.at(-1), { session: 's1' }, 'approval sends the session and nothing else');
  assert.equal(completed.redirect, '/oauth2_return');
  inst.destroy();
});

function otpRest(field, onSubmit) {
  return (name, verb, params) => {
    if (params.action) return ok({ session: 's1', req: [field.name], fields: [field] });
    onSubmit(params);
    return ok({ complete: true });
  };
}

test('OTP field renders cells from length + mask and filters typed input', async () => {
  const field = {
    cat: 'input', name: 'code', type: 'text', label: 'Code', format: 'AAAA-AAAA', hint: 'otp',
    otp: { format: 'alnum', length: 8 },
  };
  const el = document.createElement('div');
  document.body.appendChild(el);
  let sent = null;
  const inst = mount(el, { rest: otpRest(field, (p) => { sent = p; }) });
  await tick();

  assert.equal(el.querySelectorAll('.klb-login__otp-cell').length, 8);
  assert.equal(el.querySelectorAll('.klb-login__otp-group').length, 2, 'mask splits the cells 4-4');
  const input = el.querySelector('.klb-login__otp-input');

  // Typing one character at a time: case-normalized, never auto-submitted.
  input.value = 'ab-c';
  input.dispatchEvent(new window.InputEvent('input', { inputType: 'insertText' }));
  assert.equal(input.value, 'ABC');
  const cellText = [...el.querySelectorAll('.klb-login__otp-cell')].map((c) => c.textContent).join('');
  assert.equal(cellText, 'ABC');
  input.value = 'ABCDEFGH';
  input.dispatchEvent(new window.InputEvent('input', { inputType: 'insertText' }));
  await tick();
  assert.equal(sent, null, 'typing the last character does not submit');
  inst.destroy();
});

test('pasting an OTP trims invalid characters and auto-submits', async () => {
  const field = {
    cat: 'input', name: 'otp_response', type: 'text', label: 'Code', hint: 'otp',
    otp: { format: 'all-digits', length: 6 }, attributes: { autocomplete: 'off' },
  };
  const el = document.createElement('div');
  document.body.appendChild(el);
  let sent = null;
  const inst = mount(el, { rest: otpRest(field, (p) => { sent = p; }) });
  await tick();

  const input = el.querySelector('.klb-login__otp-input');
  assert.equal(input.inputMode, 'numeric');
  assert.equal(input.getAttribute('autocomplete'), 'off', 'server autocomplete is respected');

  input.value = ' 123-456 789';
  input.dispatchEvent(new window.InputEvent('input', { inputType: 'insertFromPaste' }));
  assert.equal(input.value, '123456');
  await tick();
  assert.deepEqual(sent, { session: 's1', otp_response: '123456' });
  inst.destroy();
});

test('OTP field without a length falls back to a plain input', async () => {
  const field = { cat: 'input', name: 'otp_response', type: 'text', label: 'Code', hint: 'otp' };
  const el = document.createElement('div');
  document.body.appendChild(el);
  const inst = mount(el, { rest: otpRest(field, () => {}) });
  await tick();
  assert.equal(el.querySelector('.klb-login__otp'), null);
  assert.ok(el.querySelector('input.klb-login__input#otp_response'));
  inst.destroy();
});

test('initial step: oauth_first puts OAuth above labels; submessage only when it resolves', async () => {
  const data = (submessage) => ({
    initial: true, session: 's1', req: ['email'], message: 'Login', submessage,
    realm_flags: { oauth_first: true, user_flow_v2: true },
    fields: [
      { type: 'oauth2', id: 'g', info: { Token_Name: 'google', Name: 'Google' }, button: { 'background-color': '#ffffff' } },
      { cat: 'special', type: 'passkey', challenge: 'AAAA', rp_id: 'x', submit_as: 'passkey', timeout: 120000 },
      { cat: 'label', type: 'label', label: 'Enter your email to sign in or create an account.' },
      { cat: 'input', name: 'email', type: 'email', label: 'Email' },
    ],
  });

  const a = document.createElement('div'); document.body.appendChild(a);
  const ia = mount(a, { rest: () => ok(data('[I18N:flow_step_authenticate]')) });
  await tick();
  const order = [...a.querySelectorAll('.klb-login__oauth, .klb-login__text, input[type=email]')];
  assert.ok(order[0].classList.contains('klb-login__oauth'), 'oauth first');
  assert.ok(order[1].classList.contains('klb-login__text'), 'then the label');
  assert.equal(order[2].tagName, 'INPUT', 'then the email input');
  assert.equal(a.querySelector('.klb-login__submessage'), null, 'untranslated token is not shown');
  const oauthButtons = a.querySelector('.klb-login__oauth-buttons');
  assert.ok(oauthButtons.lastElementChild.classList.contains('klb-login__button--passkey'),
    'passkey button follows the OAuth providers');
  ia.destroy();

  const b = document.createElement('div'); document.body.appendChild(b);
  const ib = mount(b, {
    rest: () => ok(data('[I18N:flow_step_authenticate]')),
    messages: { 'en-US': { flow_step_authenticate: 'Sign in or sign up' } },
  });
  await tick();
  assert.equal(b.querySelector('.klb-login__submessage').textContent, 'Sign in or sign up');
  ib.destroy();
});
