#!/usr/bin/env bash
# Writes native/Config/Secrets.xcconfig from .env (same keys the RN app uses). Never prints values.
set -euo pipefail
cd "$(dirname "$0")/.."
out=native/Config/Secrets.xcconfig
get() { grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- || true; }
usda=$(get EXPO_PUBLIC_USDA_API_KEY)
kroger=$(get EXPO_PUBLIC_KROGER_TOKEN_PROXY_URL)
{
  echo "// GENERATED from .env by scripts/native-secrets.sh — do not commit."
  echo "USDA_API_KEY = ${usda}"
  # xcconfig treats // as a comment; the empty $() breaks the sequence.
  echo "KROGER_TOKEN_PROXY_URL = $(printf '%s' "$kroger" | sed 's#//#/$()/#')"
} > "$out"
echo "wrote $out (USDA key: $([ -n "$usda" ] && echo set || echo missing), Kroger proxy: $([ -n "$kroger" ] && echo set || echo missing))"
