import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceBackendDir = path.join(root, "src-tauri", "backend");
const distBackendDir = path.join(root, "src-tauri", "backend-dist");
const distNodeModulesDir = path.join(distBackendDir, "node_modules");
const copiedPackages = new Set();

await rm(distBackendDir, { force: true, recursive: true });
await mkdir(distBackendDir, { recursive: true });

const backendFiles = (await readdir(sourceBackendDir)).filter((file) => file.endsWith(".mjs"));
for (const file of backendFiles) {
  const sourcePath = path.join(sourceBackendDir, file);
  const destinationPath = path.join(distBackendDir, file);
  const source = await readFile(sourcePath, "utf8");
  const releaseSafeSource = source.replaceAll(
    'process.env.AGENTKITFORGE_ALLOW_DEV_OVERRIDES === "1"',
    '"0" === "1"',
  );
  await writeFile(destinationPath, releaseSafeSource);
}

await copyPackage("@agentkitforge/core");

console.log(`Prepared ${backendFiles.length} backend bridge files in ${path.relative(root, distBackendDir)}.`);
console.log(`Bundled ${copiedPackages.size} runtime package(s) for packaged app execution.`);

async function copyPackage(packageName) {
  if (copiedPackages.has(packageName)) return;
  copiedPackages.add(packageName);

  const packageJsonPath = path.join(root, "node_modules", ...packageName.split("/"), "package.json");
  const packageDir = path.dirname(packageJsonPath);
  const destinationDir = path.join(distNodeModulesDir, ...packageName.split("/"));

  await copyDirectory(packageDir, destinationDir);

  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const dependencies = Object.keys(packageJson.dependencies ?? {});
  for (const dependency of dependencies) {
    await copyPackage(dependency);
  }
}

async function copyDirectory(source, destination) {
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".bin") continue;

    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      await copyFile(sourcePath, destinationPath);
    }
  }
}
