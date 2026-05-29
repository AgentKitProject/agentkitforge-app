# Contributing to AgentKitForge

AgentKitForge welcomes public contributions to the desktop app. This repository is the public contribution target for the Tauri + React app.

The website/deployment infrastructure and Agent Kit Market backend are not public contribution targets.

## Local Setup

Prerequisites:

- Node.js 26.
- npm.
- Rust stable and Cargo.
- Tauri v2 prerequisites for your OS.
- Windows release builds require the Tauri Windows bundling toolchain used by `npm run build:tauri`.

Install dependencies:

```powershell
npm ci
```

Run the local app:

```powershell
npm run dev
```

## Checks

Before opening a pull request, run:

```powershell
npm run check
npm run smoke
npm run build:tauri
```

`npm run smoke` runs the lightweight TypeScript/Rust check plus the frontend build. Use `npm run build:tauri` when your change may affect desktop packaging, Tauri commands, Rust code, bundled resources, app metadata, or release behavior.

## Contribution Scope

Good contribution areas include:

- Desktop app UX.
- AI providers.
- Local agent adapters.
- Import/export workflows.
- Guided Builder.
- Use mode.
- Tests.
- Documentation.

Please open an issue or discussion before starting work on:

- Tauri permission or capability changes.
- Credential/API key handling.
- Major UI redesigns.
- Provider authentication changes.
- Installer or release changes.
- Security-sensitive import logic.

## Pull Requests

Keep pull requests focused and explain the user-facing behavior change. Include screenshots for UI changes, describe security implications where relevant, and update docs when workflows change.
