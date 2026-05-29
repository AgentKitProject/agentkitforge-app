# Versioning

AgentKitForge uses Semantic Versioning.

Versions follow:

```text
MAJOR.MINOR.PATCH
```

## Pre-1.0 Policy

While AgentKitForge is below `1.0.0`, minor versions may include breaking changes as the app, Agent Kit format support, and integration boundaries stabilize.

Patch versions should be reserved for compatible fixes, small UX improvements, documentation updates, and security hardening.

## App Releases

The desktop app version should align across:

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- About screen
- Release notes
- Installer metadata

The current release target is `v0.1.0 Public Preview`.

## Agent Kit Schema Versions

The app release version is separate from Agent Kit `schemaVersion`.

Agent Kit `schemaVersion` describes the kit file format. AgentKitForge app versions describe the desktop app release. A future app release may support multiple Agent Kit schema versions.
