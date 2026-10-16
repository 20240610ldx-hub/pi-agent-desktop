import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  compareVersions,
  fetchLatestRelease,
  nextPatchVersion,
  normalizeVersion,
  rootDir,
} from "./release-components.mjs";

const packagePath = join(rootDir, "src-tauri", "pilaude-package.json");
const cargoPath = join(rootDir, "src-tauri", "Cargo.toml");
const lockPath = join(rootDir, "src-tauri", "Cargo.lock");
const desktopPackage = JSON.parse(await readFile(packagePath, "utf8"));
const [cargo, lock] = await Promise.all([
  readFile(cargoPath, "utf8"),
  readFile(lockPath, "utf8"),
]);
const cargoVersionPattern = /^(version\s*=\s*")[^"]+("[ \t]*\r?)$/m;
const lockVersionPattern = /(name = "pi-agent-desktop"\r?\nversion = ")[^"]+(")/;
if (!cargoVersionPattern.test(cargo) || !lockVersionPattern.test(lock)) {
  throw new Error("Cannot locate the Pilaude Cargo package; no versions were changed.");
}
const current = normalizeVersion(desktopPackage.version);
const latest = await fetchLatestRelease(desktopPackage.repository, {
  allowMissing: true,
  includePrereleases: true,
});
const next = nextPatchVersion(
  latest && compareVersions(latest.version, current) > 0 ? latest.version : current,
);

desktopPackage.version = next;
await writeFile(packagePath, `${JSON.stringify(desktopPackage, null, 2)}\n`);

await writeFile(cargoPath, cargo.replace(cargoVersionPattern, `$1${next}$2`));

await writeFile(
  lockPath,
  lock.replace(lockVersionPattern, `$1${next}$2`),
);
console.log(`Pilaude ${current} -> ${next}`);
