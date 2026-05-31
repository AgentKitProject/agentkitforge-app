import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extension = process.platform === "win32" ? ".exe" : "";
const sidecarPath = path.join(root, "src-tauri", "target", "release", `node${extension}`);

try {
  await access(sidecarPath);
  console.log(`Tauri sidecar check passed: ${path.relative(root, sidecarPath)}`);
} catch {
  throw new Error(`Missing Tauri release sidecar: ${path.relative(root, sidecarPath)}`);
}
