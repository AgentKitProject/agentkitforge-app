# Release Process

This process is for AgentKitForge desktop app releases.

## Before Release

1. Confirm the target version in:
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`
   - About screen
   - `RELEASE_NOTES.md`
2. Review `RELEASE_CHECKLIST.md`.
3. Confirm known limitations are still accurate.
4. Confirm code signing and auto-update status are accurately documented.

## Build

Run:

```powershell
npm run build:backend
npm run check
npm run smoke
npm run build:tauri
```

Windows artifacts are expected under:

- `src-tauri/target/release/bundle/msi/`
- `src-tauri/target/release/bundle/nsis/`

macOS artifacts, when built on macOS, are expected under:

- `src-tauri/target/release/bundle/dmg/`
- `src-tauri/target/release/bundle/macos/`

Linux artifacts, when built on Linux, are expected under:

- `src-tauri/target/release/bundle/appimage/`
- `src-tauri/target/release/bundle/deb/`
- `src-tauri/target/release/bundle/rpm/`

Suggested public artifact names:

- `AgentKitForge-0.1.0-setup.exe`
- `AgentKitForge-0.1.0-x64.msi`
- `checksums.txt`

## Release Please

Release PRs are generated automatically by Release Please from Conventional Commits on `main`.

Release Please updates:

- `package.json`
- `package-lock.json`
- `src-tauri/tauri.conf.json`
- `RELEASE_NOTES.md`

The current release target is `v0.1.0 Public Preview`.

Release happens when the Release Please PR is merged. Release Please creates the git tag and GitHub Release. GitHub Release titles use:

```text
AgentKitForge vX.Y.Z
```

Version rules:

- `feat:` creates a minor release.
- `fix:` and `fix(security):` create a patch release.
- Breaking changes before `1.0.0` are treated as minor releases and must be documented.

When Release Please creates a GitHub Release, the same `release-please.yml` workflow builds and uploads the Windows installer artifacts. This avoids relying on a separate `release: published` workflow trigger, which GitHub can suppress when the release is created with `GITHUB_TOKEN`.

## Core Dependency

The desktop app consumes `@agentkitforge/core` from npm using semver.

Current app dependency format:

```json
"@agentkitforge/core": "^0.2.0"
```

Core package publishing is handled separately from the app release process.

## Checksums

Generate SHA-256 checksums for the final upload filenames.

Example PowerShell command after copying/renaming artifacts into a release folder:

```powershell
Get-FileHash .\AgentKitForge-0.1.0-setup.exe, .\AgentKitForge-0.1.0-x64.msi -Algorithm SHA256 |
  ForEach-Object { "$($_.Hash)  $([System.IO.Path]::GetFileName($_.Path))" } |
  Set-Content .\checksums.txt
```

## Release Artifacts

1. Release Please publishes the GitHub Release and tag.
2. The `release-please.yml` workflow runs a dependent `build-release-artifacts` job when a release was created.
3. The automatic job builds Windows installers on `windows-latest`. Windows is currently the main supported public release platform.
4. The job uploads these assets to the GitHub Release:
   - `AgentKitForge-${version}-setup.exe`
   - `AgentKitForge-${version}-x64.msi`
   - `AgentKitForge-${version}-checksums.txt`
   - `RELEASE_NOTES.md`
5. After artifact upload, the job dispatches the private infra repo with event type `app-release-published`.
6. The private infra repo mirrors the artifacts to `agentkitforge.com`.

The app repo does not store AWS credentials and does not upload directly to S3. Website/S3 mirroring is owned by the private `AgentKitProject/agentkitforge-infra` repository.

Set `AGENTKIT_INFRA_DISPATCH_TOKEN` in this public app repository with the minimum GitHub permissions needed to call `repository_dispatch` on the private infra repo. If this secret is missing, artifact upload still completes, but automatic release runs fail at the infra dispatch requirement so website mirroring is not silently skipped.

`release-artifacts.yml` is manual fallback only. Use it to rebuild or replace assets for an existing GitHub Release by providing the release version. The fallback accepts a `platforms` input:

- `windows`
- `macos`
- `linux`
- `all`

Manual fallback runs verify the release exists, build/upload selected platform artifacts, generate per-platform SHA-256 checksum files, and dispatch the infra mirror workflow when `AGENTKIT_INFRA_DISPATCH_TOKEN` is available. The dispatch payload includes the selected platform list.

Do not point the website at artifacts until they exist and the infra mirror has completed.

## Current Release Caveats

- Windows release artifacts are signed with Microsoft Artifact Signing / Trusted Signing in GitHub Actions before checksums are generated. Local development builds are unsigned.
- Auto-update is not configured yet.
- macOS and Linux artifacts can be built by the manual fallback workflow once platform publishing is enabled, but they are not public download targets yet.
- macOS signing and notarization are not configured yet. Any macOS artifacts produced before that work are unsigned and should be treated as preview/validation artifacts.
- Linux artifacts are unsigned except for SHA-256 checksums unless a separate signing process is configured.
- Do not list macOS or Linux on the website Download page until the product decision says those platforms are public release targets.
- AgentKitForge infrastructure and marketplace/backend release work lives outside this public app repository.
