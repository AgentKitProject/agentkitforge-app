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

## Release Build

For a v0.1 release build on Windows, run:

```sh
npm run check
npm run build:tauri
```

Tauri writes Windows installer artifacts under:

```text
src-tauri/target/release/bundle/msi/
src-tauri/target/release/bundle/nsis/
```

The expected Windows outputs are an `.msi` installer and an NSIS `-setup.exe` installer. Code signing is not configured yet, so Windows may show unsigned-app warnings. macOS and Linux packages are future work unless built manually on those platforms.

The app icon set is generated from `src/assets/brand/agentkitforge-icon.svg` into `src-tauri/icons/`. The Windows bundle points at `src-tauri/icons/icon.ico`.

## Branding

The desktop app follows the finalized AgentKitForge brand direction from:

```text
brand-references/agentkitforge-approved-reference.png
```

Production placeholder SVG assets live in:

```text
src/assets/brand/agentkitforge-icon.svg
src/assets/brand/agentkitforge-logo.svg
```

The UI uses the AgentKitForge light palette by default. Dark mode is available from Settings and is stored as a local app preference. Paths, generated files, package names, JSON, and command-like content use a monospace stack.

To regenerate app/taskbar icons after changing the SVG source, run `npx tauri icon src/assets/brand/agentkitforge-icon.svg`. No code signing or release upload is configured yet.

### Build Verification Checklist

- Run `npm run check`.
- Run `npm run build:tauri`.
- Create a kit from a template.
- Validate a kit from My Kits or after Build/Import.
- Run a kit with OpenAI inside Forge.
- Package/export a kit.
- Import a `.agentkit.zip` package.
- Export a kit to a Codex skills directory.

## Build Workspace

The Build page is organized as a Create/Edit workspace.

Create New:

- **Build with AI**: default mode for describing the kit you want and generating a reviewable AgentKitDraft.
- **Guided Builder**: step-by-step no-code builder for creating a kit entirely inside AgentKitForge.
- **From Template**: creates a kit from `blank` or `financial-review`.
- **From Draft JSON - Advanced**: renders an existing AgentKitDraft JSON file into a kit folder.

Edit Existing:

- **Edit with AI**: load a kit from My Kits as a draft, request changes, and save an update or save as a new kit.
- **Guided Editor**: load a kit from My Kits into the form builder and edit without touching YAML or Markdown.

AgentKitForge remembers the last Build/Edit mode you used in local browser storage. If no mode has been used yet, Build opens on **Build with AI**.

New kits default to the app-managed library folder, normally `Documents/AgentKitForge/Kits` on Windows. You can change the save location in Settings or per workflow.

## Guided Builder

Use **Guided Builder** when you want to create a kit manually without editing YAML, Markdown, or folders.

The flow has seven steps:

1. **Basics**: kit name, auto-generated kit ID, description, domain, target users, validation level, and save location.
2. **Skills**: add repeatable skills with triggers, use guidance, procedure steps, required context, output expectations, and risk level.
3. **Policies - Optional**: add domain presets or custom policies. Policies are guardrails that tell the AI what to avoid, require, or escalate. Presets cover finance/accounting, legal, healthcare/medical, DevOps/SRE, cloud/infrastructure, security, compliance, HR/recruiting, and general business.
4. **Outputs / Templates - Optional**: define expected output sections, optional output template, whether the result is document-like, suggested download name, and summary style.
5. **Prepared Prompts**: define reusable prompt templates users can run later in Use mode.
6. **Examples - Optional**: add example prompts, example input values, and expected outputs.
7. **Review & Create**: review the summary and create, validate, use, package, or open the kit.

Required steps are Basics, at least one Skill, and at least one Prepared Prompt. Policies, Templates, and Examples are optional.

Prepared Prompts are centered in the Guided Builder. Each prompt includes:

- prompt name and auto-generated prompt ID
- description
- prompt template with variables such as `{{company_name}}`
- inputs/variables with label, help text, type, required flag, placeholder, default value, choices, and include-in-prompt setting
- output mode: text, markdown, or document
- document-like output flag
- optional suggested output filename
- optional tags

Required inputs now belong inside Prepared Prompts rather than a standalone builder step. The generated kit writes these prompts to the core `preparedPrompts` draft field so Use mode can list the prompts, collect their inputs, preview the rendered prompt, and emphasize Markdown download for document-like outputs.

Guided Builder builds an AgentKitDraft internally and renders it through `agentkitforge-core`. The raw draft JSON is hidden by default and available under Advanced details after creation.

If the kit includes policies and examples, Guided Builder targets `trusted` validation where practical. Otherwise it targets the selected validation level, with `local-valid` as the minimum.

Use **Build with AI** when you want an AI provider to draft the kit from a description. Use **Guided Builder** when you want direct control through forms.

## Create a Kit From a Template

Open the Build section, choose **From Template**, and fill in:

- Target output folder
- Kit id
- Kit name
- Kit description
- Template: `blank` or `financial-review`

The app creates the kit in a child folder named after the kit id. For example, output folder `C:\kits` and kit id `customer-support` creates `C:\kits\customer-support`.

Use force overwrite only when you want template files to be written into an existing non-empty kit folder. Existing unrelated files are left in place by `agentkitforge-core`.

After creation, use **Validate created kit** from the result panel to check the kit with the default profile for the template:

- `blank` uses `local-valid`
- `financial-review` uses `trusted`

## Render From Draft JSON

Open the Build section and use **From Draft JSON** when you already have an `AgentKitDraft` JSON file:

1. Select the draft `.json` file.
2. Select the target output folder for the rendered Agent Kit.
3. Enable force overwrite only when rendering into a non-empty folder is intentional.
4. Click **Render**.
5. Use **Validate rendered kit** from the result panel to check the rendered folder.

Draft JSON is the handoff format for the AI-assisted builder flow. Later, AgentKitForge will generate these drafts from natural-language requests; for now, you can render draft JSON produced by `agentkitforge-core` or checked into local examples.

## AI Providers

AgentKitForge supports configurable AI providers for v0.1:

- OpenAI
- Anthropic / Claude API
- Google Gemini API
- Ollama
- Custom OpenAI-compatible providers

The desktop app uses `agentkitforge-core` for shared provider types, known model suggestions, default model helpers, base URL normalization, and provider capability metadata. The desktop app still owns local provider settings, API key storage, connection tests, provider-specific network adapters, and runtime request execution.

Open **Settings** to add, edit, remove, test, and choose the default provider. Known model dropdowns are suggestions only; every provider also accepts a custom model ID. This is important for local and self-hosted providers where model names are arbitrary.

Example base URLs:

- OpenAI: `https://api.openai.com/v1`
- Anthropic: `https://api.anthropic.com/v1`
- Gemini: `https://generativelanguage.googleapis.com/v1beta`
- Ollama native: `http://localhost:11434`
- Ollama OpenAI-compatible: `http://localhost:11434/v1`
- LM Studio: `http://localhost:1234/v1`
- LocalAI: `http://localhost:8080/v1`
- OpenRouter: `https://openrouter.ai/api/v1`

Use inside Forge generally works with all providers. Build with AI requires reliable JSON output because the provider must return valid AgentKitDraft JSON. If a provider is marked as not reliably supporting structured JSON, AgentKitForge shows a warning and validates the draft before rendering.

Connection tests send a very small request and report common failures such as a missing API key, invalid base URL, local server not running, model not found, malformed response, or invalid credentials. API keys are not printed by the app.

## Build With AI

Open Settings and configure an AI provider before using **Build with AI**.

In the Build section, describe the Agent Kit you want and optionally provide:

- Domain
- Target users
- Desired validation level
- Constraints
- Source notes
- Sections to include
- Example input documents
- Model override

The domain field is searchable. You can select a known domain such as Finance / Accounting, Customer Support, Security, or Software Engineering, or type any custom domain. Known domains are suggestions, not restrictions.

Build with AI is iterative. AgentKitForge uses `agentkitforge-core` to create a structured draft request, sends that request to the selected AI provider, parses the returned AgentKitDraft JSON, validates it against the core draft schema, and starts an AI Draft Session.

Generated AI drafts are not usable Agent Kits yet and are not added to My Kits automatically. They remain draft sessions until you click **Save**, which renders the current draft into an Agent Kit folder. After saving, you can validate, add to My Kits, use the kit, or package/export it.

The **Sections to include** control lets you choose which draft sections the AI should include. Basics, Skills, and Prepared Prompts are required and locked. Optional sections include Policies, Templates / Outputs, Examples, Workflows, References, Evals, and Scripts. Scripts are marked Advanced and should be selected only when the kit really needs code.

The **Example input document** control accepts `.txt`, `.md`, `.csv`, `.xlsx`, and `.xls` files. Text, Markdown, and CSV files are summarized from their extracted text. Spreadsheet support is metadata-only in v0.1 unless richer parsing is added later. Example documents are used as source notes so the AI can infer terminology, formatting, required inputs, prepared prompts, and output style. AgentKitForge does not execute anything from attached documents.

After the initial draft is created, the screen shows a friendly review workspace with:

- current draft version
- kit name, description, domain, and target users
- counts for skills, policies, prepared prompts, templates, and examples
- draft section cards for Basics, Skills, Policies, Prepared Prompts, Templates / Outputs, and Examples
- raw JSON hidden under Advanced JSON

To revise a draft, type a change request such as "Add a prepared prompt for client memos" or "Ask for company name and reporting period before running." AgentKitForge calls the core revision request builder, sends the current draft plus your change request to the selected provider, expects a full updated AgentKitDraft JSON response, validates it, and adds a new revision to the session.

Revision history shows entries such as `v1 Initial draft`, `v2 <change request summary>`, and later revisions. You can restore an older revision and save the current revision when satisfied. Visual diffing is not implemented yet.

After generation, you can:

- Copy the draft JSON.
- Save the draft JSON to disk.
- Request changes and create new revisions.
- Restore an older revision.
- Save the current draft into an Agent Kit folder.
- Validate the rendered kit.
- Clear the session and start over.

Draft JSON is the review and handoff step between AI-assisted planning and local kit generation. For v0.1, draft sessions live in app state during the session; use **Save draft JSON** to persist the current revision locally. You can edit saved drafts before rendering, or render them immediately and iterate on the generated kit files.

If a provider is marked as not reliably supporting structured JSON, AgentKitForge warns before generation and revisions. The returned draft is still validated before it can be used.

## Edit Existing Kits

Use **Edit with AI** when you want a provider to revise an existing kit. Select a kit from My Kits, enter a change request, optionally attach example input documents, and request changes. The provider must return a full updated AgentKitDraft JSON object, not a patch. You can continue revising, save draft JSON, **Save update**, or **Save as new kit**.

**Save update** rewrites the selected Agent Kit files after confirmation. **Save as new kit** renders the draft to the selected save location and leaves the original kit unchanged.

Use **Guided Editor** when you want to edit an existing kit through forms. It loads the kit with `agentkitforge-core` `loadAgentKitAsDraft`, maps it into the Guided Builder sections, and lets you save an update or create a new rendered kit. Raw draft JSON stays under Advanced details.

**From Draft JSON** is marked Advanced because it is mainly for users who already have a saved AgentKitDraft JSON file from another tool or from a prior draft session.

## Prepare for Web Assistant

Open the Use section and use **Prepare for Web Assistant** to create a one-file Markdown version of your Agent Kit and a starter prompt for tools like ChatGPT or Claude. This does not install anything; it prepares files you can upload or paste.

This is different from:

- **Use inside Forge**: AgentKitForge runs the kit with your selected AI provider.
- **Install Targets**: exports the kit into supported tools like Codex or Claude Code.
- **Package / Export**: creates shareable package artifacts.

1. Select a local Agent Kit folder.
2. Select a Markdown output file, or select an output folder to use the default `<kit-id>-<version>.onefile.md` file name.
3. Click **Export one-file Markdown**.
4. Upload the generated `.md` file to the assistant.
5. Upload any task files required by the kit.
6. Paste the generated starter prompt.
7. Review the output before relying on it.

The export uses `agentkitforge-core` one-file export logic and includes top-level kit instructions plus supported skill, prompt, and reference sections.

Normal views show friendly file names and locations first. Full filesystem paths are available in Advanced details areas when you need to copy or inspect them.

## Package / Export Artifacts

Open **Package / Export** when a kit is ready to distribute or hand off.

Choose a kit from **My Kits** first. Use **Add existing kit...** only when the kit is not in your library yet. Exports default to the app-managed exports folder, normally `Documents/AgentKitForge/Exports`; the screen shows this as **AgentKitForge Exports** and keeps the full path under Advanced details.

Artifact types:

- `.agentkit.zip`: full portable package for importing into AgentKitForge, sharing, or publishing later. It includes structure, metadata, skills, policies, prepared prompts, templates, examples, and other kit files.
- `.onefile.md`: upload-friendly Markdown bundle for uploading or pasting into web assistants like ChatGPT or Claude. It is easier to use manually, but it is not a full Agent Kit package.

Artifact names are predictable:

- `<kit-id>-<version>.agentkit.zip`
- `<kit-id>-<version>.onefile.md`

The screen can run validation before creating the `.agentkit.zip`. If validation is enabled and the selected profile fails, packaging is blocked until the kit is fixed or validation is explicitly disabled. One-file Markdown export does not run validation automatically.

After an artifact is created, use **Open output folder** or **Copy path** to locate or share the generated file.

## Use Inside Forge With AI

Open Settings and configure at least one AI provider before using the built-in runtime. API keys are stored locally in the app settings file on this machine and are not committed by the repo. This is a temporary local-storage approach for early development, so do not share local app data or check generated settings files into source control.

The default model comes from the selected/default provider. You can choose a known model suggestion or enter a custom model ID in Settings, Build, or Use.

To run a kit inside Forge:

1. Open the Use section.
2. Choose a kit from **My Kits**. Use **Add existing kit** only when the kit is not in your local library yet.
3. Choose a **Prepared Prompt** if the kit defines one.
4. Fill the required inputs shown by the prompt, such as audience, reporting period, project/environment, file summary, or desired output type.
5. Review the collapsed **Prompt Preview** before sending.
6. Open **Advanced Settings** only when you need additional context, context mode, references, max skills, prompt inclusion, or output token options.
7. If the kit has no prepared prompts, use the freeform task fallback. Prepared prompts help make repeatable workflows easier, but they are not required.
8. Keep **Validate before running** enabled unless you intentionally want to run an invalid work-in-progress kit.
9. Click **Run with AI**.
10. Review the response before relying on it.

Prepared Prompts live in the kit's `prompts/` folder. AgentKitForge lists them in friendly form, renders their input fields, validates required values, and sends the rendered prompt as the main task. Supported input types are short text, long text, choice, multi-choice, date, number, and boolean.

Prompt preview shows the final rendered prompt without exposing raw prompt JSON by default. You can expand and copy the preview before running. Additional context, raw details, included files, included skills, and context warnings are kept under Advanced sections.

If a selected prompt marks its output as document-like, **Download as Markdown** is emphasized after the response. Download names use the prompt's `suggestedFileName` when available; otherwise AgentKitForge falls back to a sensible kit-based timestamped name. Plain text download and copy response remain available.

If the kit has `START_HERE.md` or `README.md`, the Use screen shows a bounded, collapsed local hint from that file. You can expand or copy it. This does not call an AI provider.

With **Validate before running** enabled, AgentKitForge validates the selected kit with the chosen validation profile before making the AI provider request. If validation fails, the run is blocked and the validation issues are shown. Turn the checkbox off only when you deliberately want to test or debug an invalid kit.

After a response is generated, you can copy it, download it as Markdown, download it as plain text, or clear it from the screen. Saved Markdown includes the response plus run metadata for review.

### Context Builder Options

Use inside Forge builds AI context through `agentkitforge-core` Context Builder.

Context modes:

- `all`: include all declared skills.
- `triggered`: include skills whose triggers match the task. If no skill matches, the builder falls back to all skills and shows a warning.

Context target defaults to `openai`. The target labels are reserved for future adapter-specific formatting.

Include options:

- Policies: on by default.
- Templates: on by default.
- Workflows: on by default.
- References: off by default to avoid oversized context.
- Prepared prompts: on by default.

After a run, expand **Context details** to see included files, included skills, warnings, and approximate context length. Raw JSON, raw paths, base URLs, structured JSON flags, and other technical options are generally behind Advanced sections.

The response metadata panel shows the kit name when available, model used, context mode, validation profile, included skills, included file count, warnings count, and timestamp. Context builder warnings are shown in Context details; warnings may indicate fallback behavior such as triggered mode including all skills when no trigger matched.

## App Sections

- My Kits
- Import
- Build
- Use
- Package / Export
- Install Targets
- Settings
- About

Validation is contextual rather than a primary workflow. You can validate from My Kits, Build result panels, Import results, before Use with **Validate before running**, before Package / Export, and before Install Targets. When validation finds issues, the app shows **Needs attention** with issues grouped by severity; full paths and technical details stay under Advanced sections.

## Install Targets

Use **Install Targets** to export an Agent Kit into tool-specific local formats.

The first supported target is Codex skills:

1. Choose an Agent Kit from My Kits.
2. Choose the Codex skills destination folder if one has not been saved yet.
3. Enable force overwrite only when replacing AgentKitForge-generated export folders is intentional.
4. Click **Export/Install to Codex**.

Codex needs skills in its own skills folder. AgentKitForge copies the kit's skills there so Codex can discover them in future sessions. Users choose the destination skills folder; AgentKitForge remembers it locally after selection.

AgentKitForge writes files only. It does not launch Codex, restart Codex, or verify that the Codex runtime loaded the exported skills.

Claude Code plugin export is also available:

1. Choose an Agent Kit from My Kits.
2. Choose the Claude Code plugins destination folder if one has not been saved yet.
3. Enable force overwrite only when replacing the AgentKitForge-generated plugin folder is intentional.
4. Click **Export/Install to Claude Code**.

Claude Code uses plugin-style folders. AgentKitForge exports the kit as a Claude Code plugin-style package, including a plugin manifest, skills, and supported kit content. Users choose the destination plugins folder; AgentKitForge remembers it locally after selection.

AgentKitForge writes files only. It does not launch Claude Code, restart Claude Code, or verify that the Claude Code runtime loaded the plugin. This is an initial adapter, so verify plugin loading behavior in Claude Code.

## Settings

Settings controls local app defaults and AI provider access:

- AI providers: add OpenAI, Anthropic, Gemini, Ollama, or custom OpenAI-compatible providers.
- API keys: save, update, clear by editing a provider, and test the selected provider.
- Default provider and model: used by Build with AI and Use inside Forge unless changed on the screen.
- Default output folder: pre-fills build, render, export, and package destinations where applicable.
- Preferred validation profile: pre-fills validation-related workflows.
- Preferred context mode: `all` or `triggered` for Use inside Forge.
- Theme: light by default, with dark mode available when selected.
- Context include defaults: policies, templates, workflows, and references.

Use **Test selected provider** after saving provider settings. It sends a very small request with the selected/default model and reports success or a readable failure. Keys are not printed by the app.

Settings are stored in Tauri app-local data as `settings.json`. On Windows this is typically under the user's local app data folder for AgentKitForge. For v0.1 provider API keys are stored in that local settings file, not in an OS keychain. Do not share local app data or commit generated settings files.

## About

The About screen shows the AgentKitForge version, product description, links to AgentKitForge.com, Docs, and the Agent Kit Spec, plus local-only privacy and AI provider key storage notes.

Docs links:

- https://agentkitforge.com/
- https://agentkitforge.com/docs/
- https://agentkitforge.com/agent-kit-spec/

## My Kits Library

My Kits is a local-only library of Agent Kit folders on this machine. It is for kits you already have. It stores metadata and paths so you can quickly reopen, validate, use, package/export, or install kits without moving or copying the kit folders.

When My Kits has entries, it stays focused on library actions only: use, validate, package/export, install target, open folder, refresh, or remove from the library. Import and add-folder workflows live in the separate **Import** section. If the library is empty, My Kits shows shortcuts for Build with AI, Guided Builder, and Import Agent Kit.

Library entries include kit id, name, version, description, path, source, validation history, last-used time, and timestamps. **Remove from My Kits** only removes the local library entry; it does not delete files from disk.

The library is stored in Tauri app-local data as `my-kits.json`. On Windows this is typically under the user's local app data folder for AgentKitForge, alongside `settings.json`. The exact path is resolved by Tauri at runtime.

If a kit folder no longer exists, My Kits shows a warning and disables actions that need the folder.

## Import Agent Kits

Import is separate from My Kits. Use **Import** to bring in kits from elsewhere, then valid imports are added to My Kits automatically.

Import options:

- **From .agentkit.zip**: implemented for portable Agent Kit packages.
- **From Folder**: inspects an existing local Agent Kit folder, validates it, and adds valid kits to My Kits without copying it.
- **From Git Repository**: clones a public HTTPS Git repository, checks that the repository root is an Agent Kit, copies it into the AgentKitForge Library, validates it, and adds valid kits to My Kits.
- **From Agent Kit Market**: placeholder for later.
- **From Organization Repository**: placeholder for later.

To import a downloaded or shared `.agentkit.zip` package:

1. Open **Import**.
2. Click **Choose package** and select the package file.
3. Use the default destination, **AgentKitForge Library**, or choose another destination.
4. Choose a validation profile.
5. Enable force overwrite only if replacing the intended import folder is acceptable.
6. Click **Import package**.

AgentKitForge extracts the package into a subfolder under the selected destination root, based on the package filename. Import validates the extracted kit immediately. Valid imports are added to My Kits automatically. Invalid imports remain extracted so you can inspect the issues, and you can choose to add them to My Kits anyway.

The importer blocks zip path traversal and refuses to overwrite non-empty folders unless force overwrite is enabled.

To import from a folder, choose the folder that contains `agentkit.yaml`, `AGENTKIT.md`, `START_HERE.md`, and `skills/<skill-id>/SKILL.md`. AgentKitForge uses `agentkitforge-core` candidate inspection to show friendly missing-file and missing-folder explanations instead of raw validation JSON.

To import from Git, use a public HTTPS Git URL from GitHub, GitLab, Bitbucket, or another Git host. You can optionally enter a branch or ref. Private repository authentication is not supported in v0.1. AgentKitForge clones the repository to a temporary folder, inspects only the repository files, and does not execute repository scripts. The Agent Kit files must be at the repository root; otherwise the app explains what is missing and recommends importing the folder that contains the kit.

## Default App Folders

AgentKitForge uses friendly labels in normal screens and keeps full paths under Advanced details:

- **AgentKitForge Library**: normally `Documents/AgentKitForge/Kits`
- **AgentKitForge Exports**: normally `Documents/AgentKitForge/Exports`
- **AgentKitForge Drafts**: normally `Documents/AgentKitForge/Drafts`

If the configured app folder is OS-specific or changed in Settings, AgentKitForge still shows friendly labels first and exposes the exact folder path through **Show full path**, **Copy path**, or **Open folder** actions.

Raw and technical details are hidden by default. Full filesystem paths, raw draft JSON, raw provider responses, long prompt previews, validation internals, manifest details, and package internals are available through **Advanced details**, **Show full path**, **Show raw JSON**, or **Show technical details** controls when needed.

## Requirements

- Node.js
- npm
- Rust
- Tauri system dependencies for your operating system
