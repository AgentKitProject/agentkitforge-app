import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendDistDir = path.join(root, "src-tauri", "backend-dist");
const sidecarDir = path.join(root, "src-tauri", "binaries");
const expectedBridgeFiles = [
  "validate-agent-kit.mjs",
  "security-utils.mjs",
  "create-agent-kit.mjs",
  "export-agent-kit-onefile.mjs",
  "render-agent-kit-draft.mjs",
  "generate-agent-kit-draft.mjs",
  "render-generated-agent-kit-draft.mjs",
  "package-agent-kit.mjs",
  "build-agent-kit-context.mjs",
  "prepared-prompts.mjs",
  "agent-kit-app-support.mjs",
  "export-agent-kit-codex.mjs",
  "export-agent-kit-claude-code.mjs",
];

for (const file of expectedBridgeFiles) {
  await assertExists(path.join(backendDistDir, file), `Missing bundled backend bridge: ${file}`);
}

const chunks = await readdir(path.join(backendDistDir, "chunks"));
if (!chunks.some((file) => file.endsWith(".mjs"))) {
  throw new Error("Missing bundled backend runtime chunk.");
}

try {
  await access(path.join(backendDistDir, "node_modules"));
  throw new Error("backend-dist must not contain runtime node_modules.");
} catch (error) {
  if (error?.code !== "ENOENT") {
    throw error;
  }
}

await assertExists(resolveNodeSidecarPath(), "Missing bundled Node sidecar.");
console.log("Backend runtime bundle check passed.");

async function assertExists(filePath, message) {
  try {
    await access(filePath);
  } catch {
    throw new Error(message);
  }
}

function resolveNodeSidecarPath() {
  const targetTriple = resolveTauriTargetTriple();
  const extension = process.platform === "win32" ? ".exe" : "";
  return path.join(sidecarDir, `node-${targetTriple}${extension}`);
}

function resolveTauriTargetTriple() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "win32") {
    if (arch === "x64") return "x86_64-pc-windows-msvc";
    if (arch === "arm64") return "aarch64-pc-windows-msvc";
  }

  if (platform === "darwin") {
    if (arch === "x64") return "x86_64-apple-darwin";
    if (arch === "arm64") return "aarch64-apple-darwin";
  }

  if (platform === "linux") {
    if (arch === "x64") return "x86_64-unknown-linux-gnu";
    if (arch === "arm64") return "aarch64-unknown-linux-gnu";
  }

  throw new Error(`Unsupported Node sidecar platform: ${platform}/${arch}`);
}
