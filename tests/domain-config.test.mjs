import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const canonicalDomain = "https://forge.agentkitproject.com";
const legacyDomain = "https://agentkitforge.com";
const updaterPath = "/updates/latest.json";

test("Tauri updater prefers canonical Forge domain with legacy fallback", async () => {
  const config = JSON.parse(await readFile("src-tauri/tauri.conf.json", "utf8"));
  const endpoints = config.plugins?.updater?.endpoints;

  assert.ok(Array.isArray(endpoints), "updater endpoints must be configured");
  assert.equal(endpoints[0], `${canonicalDomain}${updaterPath}`);
  assert.ok(endpoints.includes(`${legacyDomain}${updaterPath}`), "legacy updater endpoint must remain as fallback");
});

test("frontend external links use canonical Forge domain", async () => {
  const appSource = await readFile("src/App.tsx", "utf8");

  assert.match(appSource, /https:\/\/forge\.agentkitproject\.com\//);
  assert.doesNotMatch(appSource, /openDocsLink\("https:\/\/agentkitforge\.com/);
});

test("Rust external URL allowlist keeps canonical links and legacy migration links", async () => {
  const rustSource = await readFile("src-tauri/src/lib.rs", "utf8");

  for (const path of ["/", "/docs/", "/agent-kit-spec/"]) {
    assert.match(rustSource, new RegExp(`${canonicalDomain.replaceAll(".", "\\.")}${path.replaceAll("/", "\\/")}`));
    assert.match(rustSource, new RegExp(`${legacyDomain.replaceAll(".", "\\.")}${path.replaceAll("/", "\\/")}`));
  }
});
