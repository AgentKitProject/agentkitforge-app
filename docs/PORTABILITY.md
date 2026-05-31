# Portability Notes

AgentKitForge is preparing for macOS and Linux support. Windows remains the current release target.

## Backend Bridge Runtime

`@agentkitforge/core` remains the canonical Agent Kit implementation. The desktop app keeps a thin Tauri/Rust command layer and invokes small Node-based backend bridge scripts for core operations.

For packaged builds, `npm run build:backend` prepares:

- self-contained bundled bridge files in `src-tauri/backend-dist/`
- bundled `@agentkitforge/core` logic and JavaScript dependencies inside those bridge bundles
- a platform-specific Node sidecar in `src-tauri/binaries/`

The packaged app does not require user-installed Node and does not require a runtime `node_modules` folder.

## Node Sidecar

Tauri bundles the sidecar from `src-tauri/binaries/node-*` using the `bundle.externalBin` configuration. `npm run build:backend` copies the Node executable used for the build into the expected Tauri sidecar filename for the current platform.

Windows release builds currently produce:

- `src-tauri/binaries/node-x86_64-pc-windows-msvc.exe`

The build script is prepared for common macOS and Linux target triples, but public macOS/Linux release publishing still needs platform packaging, signing, and notarization work.

## Runtime Resolution

Development builds use:

1. `AGENTKITFORGE_NODE`, when set.
2. System `node` on `PATH`.
3. Source bridge scripts under `src-tauri/backend/`.

Packaged builds use:

1. Bundled Node sidecar.
2. Bundled bridge resources under `backend-dist/`.

Packaged builds do not fall back to system Node. If required runtime files are missing, the app returns:

```text
AgentKitForge runtime files are missing. Please reinstall the app.
```

## Developer Overrides

Source bridge scripts still support local core development with:

- `AGENTKITFORGE_ALLOW_DEV_OVERRIDES=1`
- `AGENTKITFORGE_CORE_PATH=/path/to/agentkitforge-core`

Generated packaged bridge bundles disable those overrides.

## Opening Files and Links

Folder and documentation link opening use Tauri's opener plugin instead of direct `explorer`, `open`, `xdg-open`, or `cmd` shell commands.

## CI Smoke Coverage

The smoke workflow runs check/frontend/backend builds and Tauri build smoke on:

- `windows-latest`
- `ubuntu-latest`
- `macos-latest`

Linux jobs install the WebKitGTK/AppIndicator packages required for Tauri builds.

These jobs verify the backend runtime bundle and sidecar are present, but they do not publish macOS or Linux artifacts.
