# klbfw-login

A pluggable, CDN-updatable login module for [`klbfw`](../klbfw)-based sites,
implementing the **User Flow v2** authentication protocol (password, OTP, OAuth2,
passkeys/WebAuthn, email verification, account recovery, …).

Web authentication keeps changing — passkeys and email verification landed
recently, more will follow — and re-implementing + redeploying every site for
each change no longer scales. This module splits the problem so the parts that
evolve live on a CDN and update centrally, while sites embed only a thin, stable
adapter.

## Packages

| Package | What it is |
|---|---|
| [`@karpeleslab/klb-login-core`](packages/core) | Framework-agnostic engine **+ renderer**, zero deps. Owns the protocol, the field-type registry, passkey/OAuth logic, i18n and default styling. Served from a CDN and dynamically imported at runtime. |
| [`@karpeleslab/klb-login-vue`](packages/vue) | Thin Vue 3 plugin. Loads the CDN core, injects the klbfw transport + host i18n, forwards lifecycle events. Contains no auth logic. |

```
site (Vue plugin, thin, rarely redeployed)
  └ <KlbLogin @success/>
       │ import('…/klb-login-core@1/…')   ── fallback → bundled copy
       ▼
  klb-login-core  (CDN, evolves centrally)
       engine + field registry + renderer + passkey/oauth + i18n
       │ rest('User:flow','POST', …)   (injected klbfw transport)
       ▼
  KLB API  User:flow
```

**Why this shape:** the core owns the `field-type → (render + browser behavior +
submission-packing)` registry *and* the auth i18n strings. When the server starts
emitting a new field type (the next passkey-like method), the pinned-major CDN
core (`@1`) already knows how to render and handle it — every site picks it up
with no rebuild or redeploy. The bundled npm copy is the offline / CDN-down
fallback.

## Vue usage

```js
// main.js
import { KlbLogin } from '@karpeleslab/klb-login-vue';
app.use(KlbLogin, { theme: { accent: '#6c5ce7' } });
```

```vue
<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
function onSuccess({ redirect }) { router.push(redirect || '/dashboard'); }
</script>

<template>
  <!-- `translate` lets the site's existing auth translations win over core defaults -->
  <KlbLogin action="login" :translate="t" @success="onSuccess" />
</template>
```

## Framework-agnostic usage

```js
import { mount } from 'https://cdn.jsdelivr.net/npm/@karpeleslab/klb-login-core@1/dist/core.mjs';
import { rest } from '@karpeleslab/klbfw';

mount(document.getElementById('login'), {
  rest,
  onComplete: ({ redirect }) => { location.href = redirect || '/'; },
});
```

## Customization

- **Theme** — set `--klb-login-*` CSS variables (via the `theme` option or your
  own CSS): `accent`, `bg`, `fg`, `border`, `radius`, `width`, …
- **i18n** — pass `translate` (host translator) and/or `messages` overrides.
- **Field renderers** — pass `renderers: { [fieldType]: spec }` to override a
  single field's rendering; everything else falls back to the core.
- **Extend the core** — `registerFieldType(name, spec)` adds support for a new
  field type; shipping it in the CDN core rolls it out to all sites.

## Development

```bash
pnpm install
pnpm build                 # builds both packages
# Offline renderer demo (mock transport):
#   open packages/core/demo/index.html after `pnpm --filter @karpeleslab/klb-login-core build`
```

See [`../integration-docs/userflow.md`](../integration-docs/userflow.md) for the
authoritative User Flow v2 + passkey protocol.
