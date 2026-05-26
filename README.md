# AgentKitForge App

AgentKitForge is a desktop app for building, validating, packaging, installing, and using portable Agent Kits.

The app currently integrates with `agentkitforge-core` for local template creation and validation. Marketplace features, paid account flows, and infrastructure are intentionally out of scope.

## Local Development

Install dependencies:

```sh
npm install
```

The app uses `agentkitforge-core` as a local npm file dependency during development:

```json
"agentkitforge-core": "file:../agentkitforge-core"
```

Expected local workspace layout:

```text
agentkitforge/
  agentkitforge-app/
  agentkitforge-core/
```

Build the core package before validating kits from the desktop app:

```sh
cd ../agentkitforge-core
npm install
npm run build
cd ../agentkitforge-app
npm install
```

If your core repo lives elsewhere, set `AGENTKITFORGE_CORE_PATH` to the core repo root before launching the app. If Node is not on `PATH`, set `AGENTKITFORGE_NODE` to the Node executable path.

Run the desktop app in development mode:

```sh
npm run dev
```

Build and check the app:

```sh
npm run build
npm run check
```

Create a packaged Tauri desktop build:

```sh
npm run build:tauri
```

## Create a Kit From a Template

Open the Build section and fill in:

- Target output folder
- Kit id
- Kit name
- Kit description
- Template: `blank` or `financial-review`

The app creates the kit in a child folder named after the kit id. For example, output folder `C:\kits` and kit id `customer-support` creates `C:\kits\customer-support`.

Use force overwrite only when you want template files to be written into an existing non-empty kit folder. Existing unrelated files are left in place by `agentkitforge-core`.

After creation, use **Validate created kit** to switch to validation with the default profile for the template:

- `blank` uses `local-valid`
- `financial-review` uses `trusted`

## Render From Draft JSON

Open the Build section and use **Render from Draft JSON** when you already have an `AgentKitDraft` JSON file:

1. Select the draft `.json` file.
2. Select the target output folder for the rendered Agent Kit.
3. Enable force overwrite only when rendering into a non-empty folder is intentional.
4. Click **Render**.
5. Use **Validate rendered kit** to open the Validate section with the rendered folder selected.

Draft JSON is the handoff format for the AI-assisted builder flow. Later, AgentKitForge will generate these drafts from natural-language requests; for now, you can render draft JSON produced by `agentkitforge-core` or checked into local examples.

## Build With OpenAI

Open Settings and save an OpenAI API key before using **Build with OpenAI**.

In the Build section, describe the Agent Kit you want and optionally provide:

- Domain
- Target users
- Desired validation level
- Constraints
- Source notes
- Model override

AgentKitForge uses `agentkitforge-core` to create a structured draft request, sends that request to OpenAI, parses the returned AgentKitDraft JSON, and validates it against the core draft schema. Review the generated JSON before rendering it.

After generation, you can:

- Copy the draft JSON.
- Save the draft JSON to disk.
- Render the draft into an Agent Kit folder.
- Validate the rendered kit.

Draft JSON is the review and handoff step between AI-assisted planning and local kit generation. You can edit saved drafts before rendering, or render them immediately and iterate on the generated kit files.

## Export a One-File Markdown Bundle

Open the Use section to prepare an Agent Kit for ChatGPT, Claude, or another web assistant:

1. Select a local Agent Kit folder.
2. Select a Markdown output file, or select an output folder to use the default `<kit-folder-name>.md` file name.
3. Click **Export one-file Markdown**.
4. Upload the generated `.md` file to the assistant.
5. Upload any task files required by the kit.
6. Paste the generated starter prompt.
7. Review the output before relying on it.

The export uses `agentkitforge-core` one-file export logic and includes top-level kit instructions plus supported skill and reference sections.

## Package / Export Artifacts

Open **Package / Export** when a kit is ready to distribute or hand off.

Artifact types:

- `.agentkit.zip`: full portable package containing the Agent Kit folder contents. Use this for distribution, archival, or later install/import workflows.
- `.onefile.md`: upload-friendly Markdown bundle containing the main instructions and supported kit content. Use this with ChatGPT, Claude, or another assistant that accepts file uploads.

The screen can run validation before creating the `.agentkit.zip`. If validation is enabled and the selected profile fails, packaging is blocked until the kit is fixed or validation is explicitly disabled. One-file Markdown export does not run validation automatically.

After an artifact is created, use **Open output folder** or **Copy path** to locate or share the generated file.

## Use Inside Forge With OpenAI

Open Settings and save an OpenAI API key before using the built-in runtime. The key is stored locally in the app settings file on this machine and is not committed by the repo. This is a temporary local-storage approach for early development, so do not share local app data or check generated settings files into source control.

The default model is `gpt-5-mini`, which is intended as a cost-efficient model for well-defined text tasks. You can change the default model in Settings or override it in the Use screen.

To run a kit inside Forge:

1. Open the Use section.
2. Select a local Agent Kit folder.
3. Enter the task.
4. Optionally add extra context.
5. Confirm the model and output token limit.
6. Click **Run**.
7. Review the response before relying on it.

For v0.1, Forge includes `AGENTKIT.md`, every `skills/*/SKILL.md` file, and supported files from `policies/` and `templates/` in the OpenAI prompt. Advanced skill routing and file uploads are not implemented yet.

### Context Builder Options

Use inside Forge builds OpenAI context through `agentkitforge-core` Context Builder.

Context modes:

- `all`: include all declared skills.
- `triggered`: include skills whose triggers match the task. If no skill matches, the builder falls back to all skills and shows a warning.

Context target defaults to `openai`. The target labels are reserved for future adapter-specific formatting; install targets are not implemented yet.

Include options:

- Policies: on by default.
- Templates: on by default.
- Workflows: on by default.
- References: off by default to avoid oversized context.

After a run, expand **Context details** to see included files, included skills, warnings, and approximate context length.

## App Sections

- My Kits
- Build
- Use
- Validate
- Package / Export
- Settings

## My Kits Library

My Kits is a local-only library of Agent Kit folders on this machine. It stores metadata and paths so you can quickly reopen, validate, use, or package kits without moving or copying the kit folders.

Library entries include kit id, name, version, description, path, source, validation history, last-used time, and timestamps. Removing a kit from My Kits only removes the local library entry; it does not delete files from disk.

The library is stored in Tauri app-local data as `my-kits.json`. On Windows this is typically under the user's local app data folder for AgentKitForge, alongside `settings.json`. The exact path is resolved by Tauri at runtime.

If a kit folder no longer exists, My Kits shows a warning and disables actions that need the folder.

## Import .agentkit.zip Packages

Use **My Kits** to import a downloaded or shared `.agentkit.zip` package:

1. Click **Import .agentkit.zip**.
2. Select the package file.
3. Select a destination root folder.
4. Choose a validation profile.
5. Enable force overwrite only if replacing the intended import folder is acceptable.
6. Click **Import package**.

AgentKitForge extracts the package into a subfolder under the selected destination root, based on the package filename. Import validates the extracted kit immediately. Valid imports are added to My Kits automatically. Invalid imports remain extracted so you can inspect the issues, and you can choose to add them to My Kits anyway.

The importer blocks zip path traversal and refuses to overwrite non-empty folders unless force overwrite is enabled.

## Requirements

- Node.js
- npm
- Rust
- Tauri system dependencies for your operating system
