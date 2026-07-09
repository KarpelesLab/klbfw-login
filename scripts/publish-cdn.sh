#!/usr/bin/env bash
#
# Publish the built klb-login core to the CDN (Cloudflare R2, S3-compatible).
#
# Uploads two keys derived from packages/core's version, e.g. for 1.4.2:
#   klb-login/core/1.4.2/core.mjs   immutable, 1-year cache   (exact version)
#   klb-login/core/v1/core.mjs      short cache               (major pointer)
# Sites load the major pointer (…/core/v1/core.mjs), so a fresh 1.x release
# reaches every site automatically — no site redeploy. Breaking changes bump the
# major and publish under …/core/v2/… instead, which sites opt into explicitly.
#
# Usage:
#   scripts/publish-cdn.sh [--no-build] [--cors] [--dry-run]
#
#   --no-build   skip `pnpm build` and upload the existing dist/core.mjs
#   --cors       (re)apply the bucket CORS policy (needed once per bucket so
#                cross-origin `import()` of the module works from any site)
#   --dry-run    print the commands without touching the bucket
#
# Overridable via env: KLB_LOGIN_CDN_BUCKET, KLB_LOGIN_CDN_PREFIX,
#                      KLB_LOGIN_CDN_HOST
set -euo pipefail

BUCKET="${KLB_LOGIN_CDN_BUCKET:-atonline-cdn}"
PREFIX="${KLB_LOGIN_CDN_PREFIX:-klb-login/core}"
HOST="${KLB_LOGIN_CDN_HOST:-cdn.atonline.net}"

do_build=1
do_cors=0
dry=0
for arg in "$@"; do
  case "$arg" in
    --no-build) do_build=0 ;;
    --cors) do_cors=1 ;;
    --dry-run) dry=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
core_dir="$repo_root/packages/core"
dist="$core_dir/dist/core.mjs"

version="$(node -p "require('$core_dir/package.json').version")"
major="${version%%.*}"

run() {
  if [[ "$dry" == 1 ]]; then
    printf 'DRY-RUN: %s\n' "$*"
  else
    "$@"
  fi
}

if [[ "$do_build" == 1 ]]; then
  echo "==> Building core"
  run bash -c "cd '$core_dir' && pnpm build"
fi

if [[ ! -f "$dist" && "$dry" != 1 ]]; then
  echo "error: $dist not found (build failed or --no-build with no prior build)" >&2
  exit 1
fi

if [[ "$do_cors" == 1 ]]; then
  echo "==> Applying bucket CORS (GET/HEAD from any origin)"
  cors_file="$(mktemp)"
  trap 'rm -f "$cors_file"' EXIT
  cat > "$cors_file" <<'JSON'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["Content-Length", "Content-Type"],
      "MaxAgeSeconds": 3600
    }
  ]
}
JSON
  run aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration "file://$cors_file"
fi

echo "==> Uploading core $version to s3://$BUCKET/$PREFIX/"

# Exact, immutable version.
run aws s3 cp "$dist" "s3://$BUCKET/$PREFIX/$version/core.mjs" \
  --content-type text/javascript \
  --cache-control 'public, max-age=31536000, immutable'

# Mutable major pointer. 1-hour cache — a new 1.x release propagates within an
# hour (still far faster than redeploying sites); purge the Cloudflare cache for
# this path if you need it live immediately.
run aws s3 cp "$dist" "s3://$BUCKET/$PREFIX/v$major/core.mjs" \
  --content-type text/javascript \
  --cache-control 'public, max-age=3600'

echo
echo "Published:"
echo "  https://$HOST/$PREFIX/$version/core.mjs   (immutable)"
echo "  https://$HOST/$PREFIX/v$major/core.mjs     (major pointer — sites load this)"
echo
echo "Note: the major pointer has a 1-hour cache; a new release is live within"
echo "~1 hour (or purge the Cloudflare cache for that path to force it now)."
