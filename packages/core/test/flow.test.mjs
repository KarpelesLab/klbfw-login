// Headless FlowController tests — no DOM required.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFlow } from '../src/index.js';

const ok = (data) => Promise.resolve({ result: 'success', data });

// A scripted User:flow: identifier -> password -> complete, plus oauth + a
// reset_password branch reachable via switchAction.
function scriptedRest() {
  let step = 0;
  return (name, verb, params) => {
    assert.equal(name, 'User:flow');
    if (params.oauth2) return ok({ url: 'https://provider.example/auth?x=1' });
    if (params.action === 'reset_password') {
      return ok({ initial: true, session: 'r1', message: 'Reset', req: ['email'],
        fields: [{ cat: 'input', name: 'email', type: 'email', label: 'Email' }] });
    }
    if (params.action) { // fresh login start
      step = 1;
      return ok({ initial: true, session: 's1', message: 'Login', req: ['email'],
        fields: [{ cat: 'input', name: 'email', type: 'email', label: 'Email' }] });
    }
    if (step === 1) {
      step = 2;
      return ok({ session: 's2', req: ['password'],
        fields: [{ cat: 'input', name: 'password', type: 'password', label: 'Password' }] });
    }
    return ok({ complete: true, user: { Email: 'a@b.c' }, Redirect: '/dash', Token: 'tok' });
  };
}

test('walks login -> password -> complete and advances the session', async () => {
  const states = [];
  let completed = null;
  const f = createFlow({
    rest: scriptedRest(),
    onStateChange: (s) => states.push(s.status),
    onComplete: (r) => { completed = r; },
  });

  await f.start('login');
  assert.equal(f.getState().status, 'ready');
  assert.equal(f.getState().session, 's1');

  f.setValue('email', 'a@b.c');
  await f.submit();
  assert.equal(f.getState().session, 's2');

  f.setValue('password', 'pw');
  await f.submit();

  assert.equal(f.getState().status, 'complete');
  assert.deepEqual(completed, { user: { Email: 'a@b.c' }, token: 'tok', redirect: '/dash', data: completed.data });
  assert.deepEqual(states, ['loading', 'ready', 'submitting', 'ready', 'submitting', 'complete']);
});

test('email is preserved across steps, other values are dropped', async () => {
  const f = createFlow({ rest: scriptedRest() });
  await f.start('login');
  f.setValue('email', 'keep@me.com');
  f.setValue('junk', 'x');
  await f.submit();
  assert.equal(f.getState().values.email, 'keep@me.com');
  assert.equal(f.getState().values.junk, undefined);
});

test('oauth response triggers a redirect via onRedirect', async () => {
  let redirected = null;
  const f = createFlow({ rest: scriptedRest(), onRedirect: (url) => { redirected = url; } });
  await f.start('login');
  await f.oauth('google');
  assert.equal(redirected, 'https://provider.example/auth?x=1');
  assert.equal(f.getState().status, 'redirecting');
});

test('switchAction restarts the flow under a new action', async () => {
  const f = createFlow({ rest: scriptedRest() });
  await f.start('login');
  await f.switchAction('reset_password');
  assert.equal(f.getState().action, 'reset_password');
  assert.equal(f.getState().session, 'r1');
});

test('a rejected call surfaces an error state without throwing', async () => {
  const f = createFlow({
    rest: () => Promise.reject({ result: 'error', token: 'error_invalid_value', error: 'nope' }),
    onError: () => {},
  });
  await f.start('login');
  assert.equal(f.getState().status, 'error');
  assert.match(f.getState().error, /invalid|nope/i);
});

test('requires a rest function', () => {
  assert.throws(() => createFlow({}), /rest/);
});
