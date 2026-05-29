# Security CI Policy

AgentKitForge v0.1 uses a practical security gate for a Tauri, React, TypeScript, and Rust desktop app. The policy is intentionally strict for secrets and critical production dependency risk, while leaving noisy dependency classes as reports until the app has more release history.

## Blocking checks

CI fails on:

- Detected secrets from gitleaks.
- Critical production npm vulnerabilities from `npm audit --audit-level=critical --omit=dev --package-lock-only`.
- RustSec advisories from `cargo audit` in `src-tauri`.

`cargo audit` does not provide a simple, stable severity threshold that cleanly maps to high/critical in this workflow, so RustSec currently fails on any reported advisory. This is stricter than the intended high/critical policy and can be relaxed later if severity filtering becomes reliable enough for this repo.

## Non-blocking checks

CI reports but does not initially fail on:

- High npm vulnerabilities.
- Moderate/medium npm vulnerabilities.
- Low vulnerabilities.
- Dev-only npm dependency vulnerabilities.
- Outdated dependencies.

High npm vulnerabilities are warning-only for v0.1 because frontend/Tauri dependency trees can produce noisy advisories in development-only tooling. Critical production advisories remain blocking.

## CodeQL

CodeQL runs JavaScript/TypeScript analysis and reports findings through GitHub code scanning. Once CodeQL has run long enough to establish a stable baseline, high and critical CodeQL security findings should become release-blocking through repository rules or branch protection.

Rust CodeQL is not enabled yet because the Tauri Linux build environment can require additional system packages and may make the first security workflow unstable. Rust dependency risk is covered by RustSec in this v0.1 policy.

## Future tightening

After v0.1, tighten the policy by:

- Failing on high production npm vulnerabilities.
- Adding explicit dev-only vulnerability review rules.
- Adding Rust CodeQL if the build environment is stable.
- Adding dependency freshness checks.
- Adding scheduled scans.
