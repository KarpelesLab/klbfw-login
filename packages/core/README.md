# @karpeleslab/klb-login-core

Framework-agnostic **User Flow v2** login engine + renderer for
[`klbfw`](https://github.com/KarpelesLab/klbfw)-based sites. Zero dependencies,
shipped as a single ESM file so it can be served from a CDN and dynamically
imported at runtime — new authentication mechanisms added here roll out to every
site without a redeploy.

Handles password, OTP, OAuth2, passkeys/WebAuthn (login + registration +
conditional autofill), email verification, account recovery and more, driven
entirely by the fields the API returns.

## Install

```bash
npm install @karpeleslab/klb-login-core
```

Or load straight from a CDN:

```js
import { mount } from 'https://cdn.atonline.net/klb-login/core/v1/core.mjs';
```

## Usage

```js
import { mount } from '@karpeleslab/klb-login-core';
import { rest } from '@karpeleslab/klbfw';

const instance = mount(document.getElementById('login'), {
  rest,                                   // required: klbfw-style transport
  action: 'login',                        // or 'register', 'reset_password', …
  theme: { accent: '#6c5ce7' },           // --klb-login-* overrides
  onComplete: ({ redirect }) => { location.href = redirect || '/'; },
});
// instance.destroy();  instance.start('register');
```

### Extend it

```js
import { registerFieldType } from '@karpeleslab/klb-login-core';

registerFieldType('my_method', {
  match: (field) => field.type === 'my_method',
  render: (field, ctx) => { /* return a DOM node */ },
  onStepEnter: (field, ctx) => { /* optional; return a cleanup fn */ },
});
```

## API

- `mount(element, opts)` → `{ controller, start, destroy }`
- `createFlow(opts)` → headless `FlowController` (no DOM)
- `registerFieldType(name, spec)` → extend the field registry

See the [repository README](https://github.com/KarpelesLab/klbfw-login) and the
User Flow v2 integration doc for the full protocol.

## License

MIT © Karpelès Lab Inc.
