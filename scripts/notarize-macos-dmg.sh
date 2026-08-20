#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RELEASE_REPO="${EHTO_RELEASE_REPO:-rikuws/ehto-releases}"
DMG="${1:-}"
SEARCH_ROOT="$ROOT/src-tauri/target"
if [[ -n "${TAURI_TARGET:-}" ]]; then
  SEARCH_ROOT="$ROOT/src-tauri/target/$TAURI_TARGET"
fi

find_one() {
  local description="$1"
  shift

  local found=""
  local count=0
  local path

  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    found="$path"
    count=$((count + 1))
  done < <(find "$SEARCH_ROOT" "$@" -print | sort)

  if [[ "$count" -ne 1 ]]; then
    echo "Expected exactly one $description under $SEARCH_ROOT, found $count." >&2
    find "$SEARCH_ROOT" "$@" -print | sort >&2
    exit 1
  fi

  printf '%s' "$found"
}

if [[ -z "$DMG" ]]; then
  DMG="$(
    find_one "DMG" \( \
      -path '*/release/bundle/dmg/*.dmg' -o \
      -path '*/debug/bundle/dmg/*.dmg' \
    \) -type f
  )"
fi

if [[ ! -f "$DMG" ]]; then
  echo "No DMG found at: $DMG" >&2
  exit 1
fi

APP="$(
  find_one "app bundle" \( \
    -path '*/release/bundle/macos/*.app' -o \
    -path '*/debug/bundle/macos/*.app' \
  \) -type d
)"

missing=()
for name in APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID; do
  if [[ -z "${!name:-}" ]]; then
    missing+=("$name")
  fi
done
if ((${#missing[@]})); then
  echo "Missing notarization environment variable(s): ${missing[*]}" >&2
  exit 1
fi

app_sign="$(codesign -dvv "$APP" 2>&1)"
if ! grep -q "Authority=Developer ID Application" <<<"$app_sign"; then
  echo "The app is not signed with a Developer ID Application certificate." >&2
  echo "$app_sign" >&2
  exit 1
fi

dmg_sign="$(codesign -dvv "$DMG" 2>&1)"
if ! grep -q "Authority=Developer ID Application" <<<"$dmg_sign"; then
  echo "The DMG is not signed with a Developer ID Application certificate." >&2
  echo "$dmg_sign" >&2
  exit 1
fi

xcrun stapler validate "$APP"
spctl -a -vv -t exec "$APP"

xcrun notarytool submit "$DMG" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait
xcrun stapler staple "$DMG"
xcrun stapler validate "$DMG"
spctl -a -vv -t open --context context:primary-signature "$DMG"

if [[ -n "${RELEASE_TAG:-}" ]]; then
  if [[ -z "${GH_TOKEN:-${GITHUB_TOKEN:-}}" ]]; then
    echo "RELEASE_TAG is set, but GH_TOKEN is missing." >&2
    exit 1
  fi

  asset_names="$(
    gh release view "$RELEASE_TAG" --repo "$RELEASE_REPO" --json assets --jq '.assets[].name'
  )"

  if [[ "$DMG" == *aarch64* ]]; then
    asset_name="$(grep -E 'aarch64.*\.dmg$' <<<"$asset_names" || true)"
  elif [[ "$DMG" == *x64* || "$DMG" == *x86_64* ]]; then
    asset_name="$(grep -E '(x64|x86_64).*\.dmg$' <<<"$asset_names" || true)"
  else
    echo "Could not determine the release asset architecture from: $DMG" >&2
    exit 1
  fi

  if [[ -z "$asset_name" || "$asset_name" == *$'\n'* ]]; then
    echo "Expected exactly one matching DMG asset in $RELEASE_TAG." >&2
    printf '%s\n' "$asset_names" >&2
    exit 1
  fi

  upload_dir="$(mktemp -d)"
  upload_path="$upload_dir/$asset_name"
  cp "$DMG" "$upload_path"
  gh release upload "$RELEASE_TAG" "$upload_path" --repo "$RELEASE_REPO" --clobber
  rm -rf "$upload_dir"
fi

echo "Notarized $DMG"
