import path from "node:path";
import { pathToFileURL } from "node:url";

const [, , rootPath, outputPath] = process.argv;

if (!rootPath || !outputPath) {
  console.error("Usage: node package-agent-kit.mjs <rootPath> <outputPath>");
  process.exit(2);
}

try {
  const core = await loadCore();
  const artifactPath = await core.packageAgentKit(rootPath, outputPath);
  process.stdout.write(JSON.stringify({ artifactPath, artifactType: ".agentkit.zip" }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function loadCore() {
  if (process.env.AGENTKITFORGE_CORE_PATH) {
    const entry = path.join(process.env.AGENTKITFORGE_CORE_PATH, "dist", "index.js");
    return import(pathToFileURL(entry).href);
  }

  return import("agentkitforge-core");
}
