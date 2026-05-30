# AgentKitForge Release Notes

## 1.0.0 (2026-05-30)


### Features

* prepare initial app public preview ([84aad1d](https://github.com/AgentKitProject/agentkitforge-app/commit/84aad1d47b78b9434be8a8c93a13b9dbfce39cd2))


### Bug Fixes

* use npm core package ([ed5997c](https://github.com/AgentKitProject/agentkitforge-app/commit/ed5997c1b49da42cae102fe77706dbf03953da66))
* use npm core package ([5193c5d](https://github.com/AgentKitProject/agentkitforge-app/commit/5193c5d083a5a5127278c4ade59b2b18817261fa))

## v0.1.0 Public Preview

### Overview

AgentKitForge v0.1.0 Public Preview is the first desktop release for building, reviewing, using, importing, packaging, and installing portable Agent Kits on a local machine.

This release focuses on local-first workflows: users can create new kits, edit existing kits, run kits with their chosen AI provider, package kits for sharing, import kits from common sources, and export kit content into supported local agent tools.

### Major Features

- Local My Kits library for tracking Agent Kit folders without requiring an account.
- Agent Kit validation through `agentkitforge-core` validation profiles.
- Responsive AgentKitForge-branded desktop UI with light theme by default and optional dark mode.
- Settings for AI providers, storage folders, default behavior, appearance, security/privacy notes, and About links.
- Documentation links to AgentKitForge.com, Docs, and the Agent Kit Spec.
- Local-only settings and library persistence.

### AI Providers

AgentKitForge v0.1.0 supports configurable AI providers for Build and Use workflows:

- OpenAI
- Anthropic Claude
- Google Gemini
- Ollama
- Custom OpenAI-compatible providers

Known model lists are suggestions, not constraints. Users can enter custom model IDs for hosted, local, self-hosted, and gateway-backed providers.

### Build Workflows

- Build with AI for generating AgentKitDraft JSON from a user request.
- Iterative AI Draft Sessions for requesting revisions before saving a usable Agent Kit.
- Guided Builder for no-code/manual kit creation centered around forms and recommended Prepared Prompts.
- From Template for starter kits.
- From Draft JSON for rendering an existing AgentKitDraft.
- Edit with AI for loading an existing kit as a draft and requesting changes.
- Guided Editor for form-based editing of existing kits.

AI-generated drafts are not added to My Kits automatically. A draft becomes a usable Agent Kit only after the user clicks Save and renders it into a kit folder.

### Use Workflows

- Use a Prepared Prompt when a kit defines prepared prompts.
- Write a Custom Prompt for any kit, including kits with no prepared prompts.
- Render prompt inputs with validation and preview before running.
- Run with the selected/default AI provider.
- Validate before running when enabled.
- Copy responses.
- Download responses as Markdown or text.
- Prepare for Web Assistant by exporting a one-file Markdown bundle and starter prompt.

### Import and Export

Import supports:

- `.agentkit.zip` packages.
- Existing local Agent Kit folders.
- Git repositories using the user's local Git credentials for read-only clone access.

Package / Export supports:

- Full `.agentkit.zip` packages for importing into AgentKitForge, sharing, or later publishing.
- One-file Markdown bundles (`.onefile.md`) for manual upload or paste into web assistants.

Expected Windows release artifacts are produced under:

- `src-tauri/target/release/bundle/msi/`
- `src-tauri/target/release/bundle/nsis/`

Suggested release upload names:

- `AgentKitForge-0.1.0-setup.exe`
- `AgentKitForge-0.1.0-x64.msi`
- `checksums.txt`

### Local Agent Integrations

Install on Local Agent supports:

- Codex export: copies Agent Kit skills into a Codex-compatible skills folder.
- Claude Code export: exports the kit as a Claude Code plugin-style folder.

AgentKitForge writes files only. It does not launch Codex or Claude Code, restart those tools, or verify that the external runtime loaded exported content.

### CLI/Core Relationship

The desktop app wraps `agentkitforge-core` for deterministic kit operations such as validation, scaffolding, draft rendering, packaging, one-file export, context building, prepared prompt handling, artifact naming, and app-support helpers.

Runtime AI provider calls, provider settings, local API key storage, connection tests, and desktop UI workflows live in the app layer.

### Known Limitations

- No Agent Kit Market integration yet.
- No organization/private repository sync yet.
- Git import can use local Git credentials for read-only clone access, but there is no in-app OAuth flow or Git token storage.
- No auto-update support yet.
- Code signing is not configured yet.
- macOS and Linux release packaging are future work unless built manually in those environments.
- File upload/RAG is not implemented for Use mode. Build with AI can use limited example input document support for source notes and metadata.
- Spreadsheet example document support is limited in v0.1. Text, Markdown, and CSV extraction are more reliable than Excel previews.
- Local and custom model quality varies. Structured JSON draft generation works best with providers/models that reliably return valid JSON.
- No streaming responses yet.
- No marketplace/org/account features.

### Security and Privacy Notes

- AgentKitForge is local-first and does not require an account.
- My Kits entries and app preferences are stored locally on the user's machine.
- Provider API keys are stored locally in this app's settings file on your machine, not in an OS keychain. Do not use shared or untrusted machines. You can clear stored keys from Settings.
- Provider and Git error details are redacted before display.
- Git repository import is read-only. AgentKitForge does not push commits, write to remotes, or execute repository scripts during import.
- Git imports disable interactive credential prompts, time out long-running clones, and skip symlinked files for safety.
- `.agentkit.zip` imports enforce v0.1 extraction limits to reduce zip bomb and oversized-package risk.
- Local model providers such as Ollama depend on the user's local server configuration and availability.
