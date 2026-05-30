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
npm run check
npm run smoke
npm run build:tauri
```

Windows artifacts are expected under:

- `src-tauri/target/release/bundle/msi/`
- `src-tauri/target/release/bundle/nsis/`

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

Release Please does not build or upload installer artifacts. App artifacts are built by a separate release-artifacts workflow/process so release metadata and binary production stay separate.

## Core Dependency

The desktop app consumes `@agentkitforge/core` from npm using semver.

Current app dependency format:

```json
"@agentkitforge/core": "^0.1.1"
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
2. The public app repo `release-artifacts` workflow runs on the published release.
3. The workflow builds Windows installers on `windows-latest`.
4. The workflow uploads these assets to the GitHub Release:
   - `AgentKitForge-${version}-setup.exe`
   - `AgentKitForge-${version}-x64.msi`
   - `AgentKitForge-${version}-checksums.txt`
   - `RELEASE_NOTES.md`
5. After artifact upload, the workflow dispatches the private infra repo with event type `app-release-published`.
6. The private infra repo mirrors the artifacts to `agentkitforge.com`.

The app repo does not store AWS credentials and does not upload directly to S3. Website/S3 mirroring is owned by the private `AgentKitProject/agentkitforge-infra` repository.

Set `AGENTKIT_INFRA_DISPATCH_TOKEN` in this public app repository with the minimum GitHub permissions needed to call `repository_dispatch` on the private infra repo. If this secret is missing, artifact upload still completes, but published release runs fail at the infra dispatch requirement. Manual reruns may skip dispatch when the token is absent.

Do not point the website at artifacts until they exist and the infra mirror has completed.

## Current Release Caveats

- Code signing is not configured yet.
- Auto-update is not configured yet.
- macOS and Linux release packaging are future work unless built manually in those environments.
- AgentKitForge infrastructure and marketplace/backend release work lives outside this public app repository.
