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

## App Sections

- My Kits
- Build
- Use
- Validate
- Settings

## Requirements

- Node.js
- npm
- Rust
- Tauri system dependencies for your operating system
