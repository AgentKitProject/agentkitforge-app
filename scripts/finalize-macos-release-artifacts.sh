#!/usr/bin/env bash
set -euo pipefail

if [ -z "${APPLE_SIGNING_IDENTITY_HASH:-}" ]; then
  echo "APPLE_SIGNING_IDENTITY_HASH was not set after certificate import." >&2
  exit 1
fi

if [ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ]; then
  echo "TAURI_SIGNING_PRIVATE_KEY is required to re-sign the finalized macOS updater archive." >&2
  exit 1
fi

macos_bundle_dir="src-tauri/target/release/bundle/macos"
dmg_dir="src-tauri/target/release/bundle/dmg"
dmg_path="$(find "$dmg_dir" -maxdepth 1 -name '*.dmg' -type f | head -n 1)"
dmg_script="$dmg_dir/bundle_dmg.sh"
entitlements_path="src-tauri/entitlements/node-sidecar.entitlements.plist"
dmg_source_dir="$RUNNER_TEMP/agentkitforge-dmg-source"
mount_point="$RUNNER_TEMP/agentkitforge-repack-mount"
mounted=false

if [ -z "$dmg_path" ]; then
  echo "No macOS DMG found before final artifact signing." >&2
  exit 1
fi
if [ ! -f "$dmg_script" ]; then
  echo "Generated DMG bundling script not found at $dmg_script" >&2
  exit 1
fi
if [ ! -f "$entitlements_path" ]; then
  echo "Node sidecar entitlements file not found at $entitlements_path" >&2
  exit 1
fi

cleanup() {
  if [ "$mounted" = true ]; then
    hdiutil detach "$mount_point" -quiet || true
  fi
}
trap cleanup EXIT

chmod +x "$dmg_script"
rm -rf "$dmg_source_dir" "$mount_point"
mkdir -p "$dmg_source_dir" "$mount_point" "$macos_bundle_dir"

source_app_path="$(find "$macos_bundle_dir" -maxdepth 2 -name '*.app' -type d | head -n 1)"
if [ -n "$source_app_path" ]; then
  echo "Using macOS app bundle from build output for final artifact signing: $source_app_path"
else
  echo "No writable app bundle found in build output; extracting app from generated DMG: $dmg_path"
  hdiutil attach "$dmg_path" -readonly -nobrowse -mountpoint "$mount_point" -quiet
  mounted=true
  source_app_path="$(find "$mount_point" -maxdepth 2 -name '*.app' -type d | head -n 1)"
  if [ -z "$source_app_path" ]; then
    echo "No .app bundle found inside generated DMG." >&2
    exit 1
  fi
fi

app_name="$(basename "$source_app_path")"
app_path="$dmg_source_dir/$app_name"
ditto "$source_app_path" "$app_path"
if [ "$mounted" = true ]; then
  hdiutil detach "$mount_point" -quiet
  mounted=false
fi

node_path="$app_path/Contents/MacOS/node"
main_executable="$app_path/Contents/MacOS/agentkitforge-app"

if [ ! -f "$node_path" ]; then
  echo "Bundled Node sidecar not found at $node_path" >&2
  exit 1
fi
if [ ! -f "$main_executable" ]; then
  echo "Main app executable not found at $main_executable" >&2
  exit 1
fi

echo "Re-signing bundled Node sidecar with V8 entitlements: $node_path"
codesign --force --options runtime --timestamp \
  --sign "$APPLE_SIGNING_IDENTITY_HASH" \
  --entitlements "$entitlements_path" \
  "$node_path"

node_entitlements="$RUNNER_TEMP/final-node-sidecar-entitlements.plist"
codesign -d --entitlements :- "$node_path" > "$node_entitlements" 2>&1
cat "$node_entitlements"
grep -q "com.apple.security.cs.allow-jit" "$node_entitlements"
grep -q "com.apple.security.cs.allow-unsigned-executable-memory" "$node_entitlements"

echo "Verifying finalized Node sidecar."
codesign --verify --strict --verbose=2 "$node_path"

echo "Re-signing main app executable after nested sidecar signing: $main_executable"
codesign --force --options runtime --timestamp \
  --sign "$APPLE_SIGNING_IDENTITY_HASH" \
  "$main_executable"

echo "Re-signing .app bundle after nested sidecar signing: $app_path"
codesign --force --options runtime --timestamp \
  --sign "$APPLE_SIGNING_IDENTITY_HASH" \
  "$app_path"

echo "Verifying finalized .app bundle."
codesign --verify --deep --strict --verbose=2 "$app_path"

update_archive="$(find "$macos_bundle_dir" -maxdepth 1 -name '*.app.tar.gz' -type f | head -n 1)"
if [ -z "$update_archive" ]; then
  update_archive="$macos_bundle_dir/$(basename "$dmg_path" .dmg).app.tar.gz"
fi

echo "Rebuilding macOS updater archive from finalized app: $update_archive"
rm -f "$update_archive" "$update_archive.sig"
COPYFILE_DISABLE=1 tar -czf "$update_archive" -C "$dmg_source_dir" "$app_name"

echo "Signing finalized macOS updater archive."
npm exec tauri -- signer sign "$update_archive"
if [ ! -f "$update_archive.sig" ]; then
  echo "Tauri updater signature was not created at $update_archive.sig" >&2
  exit 1
fi

echo "Repacking macOS DMG from finalized app: $dmg_path"
rm -f "$dmg_path"
"$dmg_script" \
  --volname "AgentKitForge" \
  --volicon "$dmg_dir/icon.icns" \
  --window-size 660 400 \
  --icon-size 100 \
  --icon "$app_name" 180 170 \
  --hide-extension "$app_name" \
  --app-drop-link 480 170 \
  --no-internet-enable \
  --skip-jenkins \
  "$dmg_path" \
  "$dmg_source_dir"

echo "Signing finalized macOS DMG: $dmg_path"
codesign --force --timestamp --sign "$APPLE_SIGNING_IDENTITY_HASH" "$dmg_path"
codesign --verify --deep --strict --verbose=2 "$dmg_path"

echo "macOS release artifacts finalized."
