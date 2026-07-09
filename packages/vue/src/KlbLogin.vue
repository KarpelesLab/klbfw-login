<script>
import { defineComponent, ref, inject, onMounted, onBeforeUnmount } from 'vue';
import { rest, getLocale, Get } from '@karpeleslab/klbfw';
import { loadCore } from './loadCore.js';
import { KLB_LOGIN_OPTIONS } from './plugin.js';

// Thin host for the framework-agnostic core. It resolves the klbfw transport,
// bridges the app's vue-i18n translator (so existing site translations win),
// reads OAuth-callback params from the URL, mounts the core into its element,
// and forwards the core's lifecycle callbacks as component events. It owns no
// auth logic itself — that all lives in the CDN core.
export default defineComponent({
  name: 'KlbLogin',
  props: {
    // Initial flow action; a `?action=` URL param overrides it.
    action: { type: String, default: 'login' },
    // Override the core CDN URL (e.g. pin a version, or self-host).
    coreUrl: { type: String, default: undefined },
    // CSS-variable theme overrides, e.g. { accent: '#6c5ce7', radius: '10px' }.
    theme: { type: Object, default: undefined },
    // i18n message overrides merged over the core defaults.
    messages: { type: Object, default: undefined },
    // Per-field-type renderer overrides.
    renderers: { type: Object, default: undefined },
    // Explicit locale; defaults to klbfw's getLocale().
    locale: { type: String, default: undefined },
    // Translator bridging the host i18n (e.g. vue-i18n's `t`) so a site's
    // existing auth translations override the core's bundled defaults. Pass
    // `:translate="t"`, or set it once via the plugin options.
    translate: { type: Function, default: undefined },
  },
  emits: ['success', 'error', 'state-change', 'redirect'],
  setup(props, { emit }) {
    const mountEl = ref(null);
    const globalOptions = inject(KLB_LOGIN_OPTIONS, {});
    let instance = null;

    onMounted(async () => {
      // Read query params through klbfw's Get() rather than window.location so
      // it works in SSR/prefixed (/l/en-US/…) modes and stays consistent with
      // the rest of a klbfw site. `session` is the one-time OAuth-callback token.
      const sessionFromUrl = Get('session');
      const actionFromUrl = Get('action');

      const core = await loadCore(props.coreUrl || globalOptions.coreUrl);
      if (!mountEl.value) return; // unmounted while loading

      instance = core.mount(mountEl.value, {
        rest,
        action: actionFromUrl || props.action,
        session: sessionFromUrl || null,
        locale: props.locale || globalOptions.locale || getLocale(),
        translate: props.translate || globalOptions.translate,
        messages: props.messages || globalOptions.messages,
        theme: props.theme || globalOptions.theme,
        renderers: props.renderers,
        onComplete: (result) => emit('success', result),
        onError: (err) => emit('error', err),
        onStateChange: (state) => emit('state-change', state),
        onRedirect: (url) => {
          emit('redirect', url);
          window.location.href = url;
        },
      });

      // Strip the one-time OAuth session param from the URL after resuming.
      if (sessionFromUrl) {
        const url = new URL(window.location.href);
        url.searchParams.delete('session');
        window.history.replaceState({}, document.title, url.toString());
      }
    });

    onBeforeUnmount(() => {
      if (instance) instance.destroy();
      instance = null;
    });

    return { mountEl };
  },
});
</script>

<template>
  <div class="klb-login-vue">
    <slot name="header" />
    <div ref="mountEl" />
    <slot name="footer" />
  </div>
</template>
