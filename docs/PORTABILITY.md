# Portability Notes

AgentKitForge is preparing for macOS and Linux support.

Current support status:

- Windows: supported release target.
- macOS: release artifact automation signs and notarizes public DMG artifacts; runtime validation remains required before broad promotion.
- Linux: build smoke validation is in progress; not a public release target yet.

## Backend Bridge Runtime

`@agentkitforge/core` remains the canonical Agent Kit implementation. The desktop app keeps a thin Tauri/Rust command layer and invokes small Node-based backend bridge scripts for core operations.

For packaged builds, `npm run build:backend` prepares:

- self-contained bundled bridge files in `src-tauri/backend-dist/`
- bundled `@agentkitforge/core` logic and JavaScript dependencies inside those bridge bundles
- a platform-specific Node sidecar in `src-tauri/binaries/`

The packaged app does not require user-installed Node and does not require a runtime `node_modules` folder.

Installed macOS apps launch the bundled Node executable from `AgentKitForge.app/Contents/MacOS/node`. Public macOS release workflows sign this sidecar with hardened runtime and the V8-compatible entitlements in `src-tauri/entitlements/node-sidecar.entitlements.plist`:

- `com.apple.security.cs.allow-jit`
- `com.apple.security.cs.allow-unsigned-executable-memory`

The app does not pass `--jitless` and does not rely on `NODE_OPTIONS=--jitless`. `--jitless` disables WebAssembly in this runtime path and breaks Node fetch/Undici, so the packaged sidecar must be signed with the entitlements V8 needs instead.

## Node Sidecar

Tauri bundles the sidecar from `src-tauri/binaries/node-*` using the `bundle.externalBin` configuration. `npm run build:backend` copies the Node executable used for the build into the expected Tauri sidecar filename for the current platform.

Platform sidecar names follow Tauri target triples:

- `src-tauri/binaries/node-x86_64-pc-windows-msvc.exe`
- `src-tauri/binaries/node-aarch64-pc-windows-msvc.exe`
- `src-tauri/binaries/node-x86_64-apple-darwin`
- `src-tauri/binaries/node-aarch64-apple-darwin`
- `src-tauri/binaries/node-x86_64-unknown-linux-gnu`
- `src-tauri/binaries/node-aarch64-unknown-linux-gnu`

`npm run build:backend` creates the sidecar for the OS and architecture running the build. By default it copies the Node executable running the build, but release/local packaging can set:

```text
AGENTKITFORGE_NODE_SIDECAR=/absolute/path/to/node
```

Use this when the build `node` is not suitable as a standalone sidecar. On macOS, `build:backend` rejects Node binaries with unresolved `@rpath` dynamic-library dependencies, such as Homebrew Node builds that require `libnode.*.dylib`, because Tauri's `externalBin` packaging copies the sidecar executable but not Homebrew's shared library tree. The backend and Tauri sidecar checks also execute the copied Node with `--version` so broken sidecars fail in CI before release artifacts are uploaded.

## macOS Signing and Notarization

Public macOS release artifacts require Apple Developer ID signing and notarization. Release workflows import the Developer ID certificate into a temporary keychain, build with Tauri signing/notarization environment variables, staple the notarization ticket, and verify with `codesign`, `xcrun stapler`, and `spctl` before upload.

The website mirror is dispatched only after the signed/notarized macOS artifact is uploaded to the GitHub Release and verified in the release-asset manifest. If macOS signing, notarization, stapling, or verification fails, the website remains on the previous valid release.

Required GitHub secrets:

- `APPLE_CERTIFICATE_BASE64`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_TEAM_ID`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER_ID`
- `APPLE_API_KEY`

Local development builds may still be unsigned. macOS signing is separate from Windows signing and Tauri updater signing.

## Runtime Resolution

Development builds use:

1. `AGENTKITFORGE_NODE`, when set.
2. System `node` on `PATH`.
3. Source bridge scripts under `src-tauri/backend/`.

Packaged builds use:

1. Bundled Node sidecar.
2. Bundled bridge resources under `backend-dist/`.

Packaged builds do not fall back to system Node. Missing runtime files and execution failures are reported separately:

```text
Bundled Node runtime was not found.
Bundled backend runtime files were not found.
Bundled Node runtime failed to start.
Backend runtime failed. See diagnostics.
```

The Tauri command `check_packaged_runtime_files` returns JSON-safe diagnostics for packaged runtime issues. It reports the current executable path, resource directory, resolved Node path, `backend-dist` path, required backend file presence, `node --version`, normal `node --check generate-agent-kit-draft.mjs`, and a safe fetch smoke-test result. Diagnostics must not include provider API keys, prompts, request bodies, or other secrets.

## Developer Overrides

Source bridge scripts still support local core development with:

- `AGENTKITFORGE_ALLOW_DEV_OVERRIDES=1`
- `AGENTKITFORGE_CORE_PATH=/path/to/agentkitforge-core`

Generated packaged bridge bundles disable those overrides.

## Opening Files and Links

Folder and documentation link opening use Tauri's opener plugin instead of direct `explorer`, `open`, `xdg-open`, or `cmd` shell commands.

## CI Smoke Coverage

The smoke workflow runs platform build validation on:

- `windows-latest`
- `ubuntu-latest`
- `macos-latest`

Each matrix job runs:

1. `npm ci`
2. `npm run build:backend`
3. `npm run check:backend`
4. `npm run check`
5. `npm run build:tauri`
6. `npm run check:tauri-sidecar`

Linux jobs install the WebKitGTK/AppIndicator packages required for Tauri builds.

These jobs verify `backend-dist` exists before Tauri packaging and verify the Tauri build output references the backend runtime resources and platform sidecar where practical. They do not publish macOS or Linux artifacts.

The macOS smoke job builds the `.app` bundle only. Release artifact workflows are responsible for Developer ID signing, DMG creation, notarization, stapling, and release upload.
