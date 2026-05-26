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
