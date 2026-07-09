# @karpeleslab/klb-login-vue

Thin Vue 3 adapter for [`@karpeleslab/klb-login-core`](https://www.npmjs.com/package/@karpeleslab/klb-login-core).
It dynamically loads the core from your CDN at runtime (with the npm-bundled copy
as an automatic fallback), injects the [`klbfw`](https://github.com/KarpelesLab/klbfw)
transport and your app's i18n, and forwards the flow's lifecycle as component
events. It contains no authentication logic itself — that lives in the core, so
new auth methods roll out from the CDN without redeploying your site.

## Install

```bash
npm install @karpeleslab/klb-login-vue @karpeleslab/klbfw
```

`vue` (^3.3) and `@karpeleslab/klbfw` are peer dependencies.

## Usage

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
  <!-- `:translate="t"` lets your existing auth translations win over core defaults -->
  <KlbLogin action="login" :translate="t" @success="onSuccess" />
</template>
```

### Props / events

- Props: `action`, `coreUrl`, `theme`, `messages`, `renderers`, `locale`, `translate`
- Events: `@success` (`{ user, token, redirect, data }`), `@error`, `@state-change`, `@redirect`
- Slots: `#header`, `#footer`

Set the core CDN URL globally via the plugin option `coreUrl`, or per-instance
via the `coreUrl` prop.

## License

MIT © Karpelès Lab Inc.
