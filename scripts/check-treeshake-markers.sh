#!/usr/bin/env bash
# Verify unused Service SDK markers were shaken out of the Next production JS.
# Docs: docs/research/next-tsc-namespace-treeshaking.md
#
# Usage:
#   ./scripts/check-treeshake-markers.sh
#   ./scripts/check-treeshake-markers.sh --build
#   NEXT_DIR=apps/web/.next ./scripts/check-treeshake-markers.sh
#
# Pass: used markers appear in .next/**/*.js; unused markers are absent.
# Ignores HTML/RSC and *.map for pass/fail.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DO_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --build|-b) DO_BUILD=1 ;;
    --help|-h)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg (try --help)" >&2
      exit 2
      ;;
  esac
done

if ! command -v rg >/dev/null 2>&1; then
  echo "rg (ripgrep) is required" >&2
  exit 127
fi

resolve_next_dir() {
  if [[ -n "${NEXT_DIR:-}" ]]; then
    printf '%s\n' "$NEXT_DIR"
    return
  fi
  if [[ -d apps/web/.next ]]; then
    printf '%s\n' "apps/web/.next"
    return
  fi
  if [[ -d .next ]]; then
    printf '%s\n' ".next"
    return
  fi
  return 1
}

if [[ "$DO_BUILD" -eq 1 ]]; then
  if [[ -d apps/web ]]; then
    if command -v nx >/dev/null 2>&1 || [[ -f node_modules/.bin/nx ]]; then
      bunx nx run @apps/web:build
    else
      (cd apps/web && bun run build)
    fi
  else
    bun run build
  fi
fi

NEXT_DIR_RESOLVED="$(resolve_next_dir)" || {
  echo "No .next directory found. Run a production build first, or pass --build." >&2
  echo "Override with NEXT_DIR=path/to/.next" >&2
  exit 1
}

# Markers from Lock account SDK demo API (#2). Override via env if needed.
USED="${USED_MARKERS:-EXECUTING_ACCOUNT_PUBLIC_GET_USER|EXECUTING_ACCOUNT_ADMIN_GET_USERS}"
UNUSED="${UNUSED_MARKERS:-EXECUTING_ACCOUNT_PUBLIC_UPDATE_PROFILE|EXECUTING_ACCOUNT_PUBLIC_CHANGE_PASSWORD|EXECUTING_ACCOUNT_ADMIN_SUSPEND_USER}"

# Search only production emit dirs. `.next/dev` is left by `next dev` and does
# not tree-shake — including it false-fails local checks after a prod build.
SEARCH_ROOTS=()
for sub in server static build; do
  if [[ -d "$NEXT_DIR_RESOLVED/$sub" ]]; then
    SEARCH_ROOTS+=("$NEXT_DIR_RESOLVED/$sub")
  fi
done
if [[ ${#SEARCH_ROOTS[@]} -eq 0 ]]; then
  # Caller pointed NEXT_DIR at a leaf (e.g. `.next/server`); search it directly.
  SEARCH_ROOTS=("$NEXT_DIR_RESOLVED")
fi

echo "Searching: ${SEARCH_ROOTS[*]}"
echo

echo "=== USED (expect hits in .js) ==="
if rg -n -e "$USED" "${SEARCH_ROOTS[@]}" -g '*.js' -g '!*.map'; then
  :
else
  echo "WARN: no used markers in JS (ok if fully inlined into RSC/HTML only)" >&2
fi
echo

echo "=== UNUSED (expect ZERO hits in .js) ==="
if rg -n -e "$UNUSED" "${SEARCH_ROOTS[@]}" -g '*.js' -g '!*.map'; then
  echo
  echo "FAIL: unused markers still present in JS chunks" >&2
  exit 1
fi

echo "PASS: unused markers absent from JS"
echo

echo "=== Sanity: unused in source maps (informational) ==="
if rg -n -e "$UNUSED" "${SEARCH_ROOTS[@]}" -g '*.map'; then
  echo "(unused strings may linger in maps — not a fail)"
else
  echo "(none in maps either)"
fi
