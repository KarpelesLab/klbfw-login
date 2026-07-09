# Releasing

The two packages version **independently**. In practice:

- **`klb-login-core` changes often** — new auth field types, protocol tweaks, fixes.
  These roll out to every site **at runtime via the CDN**, with no site redeploy.
- **`klb-login-vue` changes rarely** — it's a thin adapter. A vue release is only
  needed for adapter bugs/features or to follow a **breaking** core major.

The stability contract is the CDN **major pointer** `…/klb-login/core/v1/core.mjs`,
which the vue plugin loads by default. As long as core stays backward-compatible
within major 1, shipping core = pushing to that pointer. Nothing else moves.

## A. Ship a core update (the common case)

1. Make the change in `packages/core`, bump its version (patch/minor):
   `packages/core/package.json` → e.g. `1.0.0` → `1.1.0`.
2. `pnpm -r build && pnpm test`.
3. **Roll out to sites** — push to the CDN (this is what sites actually load):
   ```bash
   pnpm cdn:publish            # uploads core/<version>/ + updates core/v1 pointer
   ```
   Live within ~5 min (Cloudflare cache). Done manually from a trusted machine —
   never CI.
4. **(Recommended) update npm too** so the registry + sites' bundled fallback
   track the latest. Commit the version bump, then cut a release:
   ```bash
   git commit -am "core: <summary>" && git push
   gh release create core-v1.1.0 --generate-notes --title "core v1.1.0"
   ```
   `publish.yml` builds, tests, and publishes `klb-login-core@1.1.0` (vue is
   skipped — its version is unchanged). The CDN push in step 3 is what reaches
   live sites; npm keeps the fallback fresh for their next `install`.

## B. Ship a vue adapter update (rare)

1. Change `packages/vue`, bump `packages/vue/package.json`.
2. Commit, push, and release:
   ```bash
   gh release create vue-v1.1.0 --generate-notes --title "vue v1.1.0"
   ```
   `publish.yml` publishes `klb-login-vue@1.1.0` (core skipped).
3. Sites pick it up by bumping their `@karpeleslab/klb-login-vue` dependency and
   redeploying. This is the only routine case that needs a site redeploy — and
   it's rare by design.

## C. Breaking core change (major → v2)

A change that isn't backward-compatible must not land on the `v1` pointer (it
would break every live site at once). Instead:

1. Bump core to `2.0.0`. `pnpm cdn:publish` now writes `core/2.0.0/` **and** a new
   `core/v2/core.mjs` pointer (the pointer major is derived from the version) —
   `v1` is left untouched, so existing sites keep working.
2. Update the vue adapter to target the new pointer:
   `packages/vue/src/loadCore.js` → `DEFAULT_CORE_URL` → `…/core/v2/core.mjs`,
   bump vue's major, release `vue-v2.0.0`.
3. Sites move to v2 deliberately by bumping the vue dependency and redeploying.

So a breaking core change is the one scenario that forces a vue release + site
redeploys — which is exactly why core changes should stay within-major whenever
possible.

## Notes

- The publish workflow (`.github/workflows/publish.yml`) publishes only versions
  not already on npm, so it's safe to re-run and to bump one package at a time.
- npm auth is OIDC trusted publishing (no stored token); the CDN push uses local
  AWS/R2 credentials and is intentionally kept out of CI.
