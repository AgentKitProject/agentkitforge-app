import path from "node:path";
import { pathToFileURL } from "node:url";

const [, , action, kitPath] = process.argv;

if (!action || !kitPath) {
  console.error("Usage: node agent-kit-app-support.mjs <inspect|summary> <kitPath>");
  process.exit(2);
}

try {
  const core = await loadCore();

  if (action === "inspect") {
    const inspection = await core.inspectAgentKitCandidate(kitPath);
    process.stdout.write(JSON.stringify(inspection));
    process.exit(0);
  }

  if (action === "summary") {
    const summary = await core.getAgentKitSummary(kitPath);
    process.stdout.write(JSON.stringify(summary));
    process.exit(0);
  }

  throw new Error(`Unsupported app support action: ${action}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function loadCore() {
  if (process.env.AGENTKITFORGE_CORE_PATH) {
    const entry = path.join(process.env.AGENTKITFORGE_CORE_PATH, "dist", "index.js");
    return import(pathToFileURL(entry).href);
  }

  const siblingEntry = path.resolve(process.cwd(), "..", "agentkitforge-core", "dist", "index.js");
  try {
    return await import(pathToFileURL(siblingEntry).href);
  } catch {
    // Fall back to the installed package.
  }

  return import("agentkitforge-core");
}
