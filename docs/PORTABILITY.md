# Portability Notes

AgentKitForge is preparing for macOS and Linux support. Windows remains the current release target.

## Backend Bridge Runtime

The app still uses small Node-based backend bridge scripts for deterministic operations provided by `@agentkitforge/core`.

For packaged builds, `npm run build:backend` prepares `src-tauri/backend-dist/` with:

- copied bridge scripts
- `@agentkitforge/core`
- the runtime dependency closure needed by core

This removes the packaged app's dependency on a `node_modules` folder beside the installed app.

## Remaining Runtime Gap

The app still needs a Node executable to run backend bridge scripts. Packaged apps should not require non-technical users to install Node manually.

Before macOS/Linux public builds, choose one of these strategies:

1. Bundle a platform-specific Node sidecar for Windows, macOS, and Linux.
2. Move the bridge operations into Rust/native code and remove the Node subprocess dependency.

Current runtime detection returns a user-friendly support error if Node is not discoverable.

## Developer Overrides

Source bridge scripts still support local core development with:

- `AGENTKITFORGE_ALLOW_DEV_OVERRIDES=1`
- `AGENTKITFORGE_CORE_PATH=/path/to/agentkitforge-core`

Generated packaged bridge scripts disable those overrides.

## Opening Files and Links

Folder and documentation link opening use Tauri's opener plugin instead of direct `explorer`, `open`, `xdg-open`, or `cmd` shell commands.

## CI Smoke Coverage

The smoke workflow runs check/frontend/backend builds and Tauri build smoke on:

- `windows-latest`
- `ubuntu-latest`
- `macos-latest`

Linux jobs install the WebKitGTK/AppIndicator packages required for Tauri builds.

These jobs do not publish macOS or Linux artifacts.
