// Loads @karpeleslab/klb-login-core at runtime.
//
// Primary path: dynamic-import the pinned-major CDN build, so a freshly
// published core (including support for brand-new auth field types) reaches
// every site automatically — no site rebuild/redeploy. Fallback path: the
// npm-bundled copy, used when the CDN is unreachable (offline, CSP, outage).
//
// The `@vite-ignore` hint keeps the host bundler from trying to resolve the CDN
// URL at build time; the bundled fallback is a bare specifier the host bundles
// as a lazy chunk that only loads if the CDN import rejects.

export const DEFAULT_CORE_URL =
  'https://cdn.atonline.net/klb-login/core/v1/core.mjs';

let cached = null;

export function loadCore(url = DEFAULT_CORE_URL) {
  if (cached) return cached;
  cached = import(/* @vite-ignore */ url)
    .then((mod) => mod && mod.mount ? mod : mod.default)
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.warn('[klb-login] CDN core unavailable, using bundled fallback:', err?.message || err);
      const mod = await import('@karpeleslab/klb-login-core');
      return mod && mod.mount ? mod : mod.default;
    });
  return cached;
}
