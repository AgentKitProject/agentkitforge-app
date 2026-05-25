# AgentKitForge App

AgentKitForge is a desktop app for building, validating, packaging, installing, and using portable Agent Kits.

This first pass creates the Tauri, React, and TypeScript shell only. Core integration, marketplace features, paid account flows, and infrastructure are intentionally out of scope.

## Local Development

Install dependencies:

```sh
npm install
```

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
