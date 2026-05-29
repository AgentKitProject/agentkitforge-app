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

`agentkitforge-core` is not published to npm yet. The desktop app currently consumes the core package by Git tag.

Current app dependency format:

```json
"@agentkitforge/core": "github:BillBoardApp/agentkitforge-core#0.1.0"
```

For a different owner, use this pattern:

```json
"@agentkitforge/core": "github:<owner>/agentkitforge-core#0.1.0"
```

Do not publish `agentkitforge-core` to npm as part of the app release process.

## Checksums

Generate SHA-256 checksums for the final upload filenames.

Example PowerShell command after copying/renaming artifacts into a release folder:

```powershell
Get-FileHash .\AgentKitForge-0.1.0-setup.exe, .\AgentKitForge-0.1.0-x64.msi -Algorithm SHA256 |
  ForEach-Object { "$($_.Hash)  $([System.IO.Path]::GetFileName($_.Path))" } |
  Set-Content .\checksums.txt
```

## Release Artifacts

1. Build app artifacts from the released tag using the separate release-artifacts workflow/process.
2. Upload installer artifacts to the GitHub Release only when ready.
3. Upload `checksums.txt`.
4. Verify the release assets download correctly.
5. Update the website mirror/download links later from the private infrastructure repository.

Do not point the website at artifacts until they exist.

## Current Release Caveats

- Code signing is not configured yet.
- Auto-update is not configured yet.
- macOS and Linux release packaging are future work unless built manually in those environments.
- AgentKitForge infrastructure and marketplace/backend release work lives outside this public app repository.
