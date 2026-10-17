import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { userHome } from "./user-home";

export function resolvePilaudeAgentDir(appDataDir: string, paths = path): string {
  return paths.join(appDataDir, "Pilaude", "agent");
}

/** Runs before loading any SDK-backed server modules. Explicit test/CLI paths win. */
export function initializePilaudeData(env: NodeJS.ProcessEnv = process.env, platform = process.platform): string {
  if (env.PI_CODING_AGENT_DIR) return env.PI_CODING_AGENT_DIR;
  const paths = platform === "win32" ? path.win32 : path.posix;
  const home = env.USERPROFILE || env.HOME || userHome();
  const appData = platform === "win32" ? env.APPDATA || paths.join(home, "AppData", "Roaming")
    : platform === "darwin" ? paths.join(home, "Library", "Application Support")
      : env.XDG_DATA_HOME || paths.join(home, ".local", "share");
  return env.PI_CODING_AGENT_DIR = resolvePilaudeAgentDir(appData, paths);
}

export interface ImportPlan {
  sourceDir: string;
  targetDir: string;
  files: { relativePath: string; conflict: boolean }[];
  excluded: string[];
}

/** Preview only: no code is evaluated, no source file is modified or followed through links. */
export async function planPiImport(sourceDir: string, targetDir: string): Promise<ImportPlan> {
  const plan: ImportPlan = { sourceDir, targetDir, files: [], excluded: [] };
  const visit = async (directory: string) => {
    for (const entry of await readdir(path.join(sourceDir, directory), { withFileTypes: true })) {
      const relativePath = path.posix.join(directory.replaceAll("\\", "/"), entry.name);
      const safe = relativePath === "settings.json" || relativePath === "models.json" || relativePath.startsWith("sessions/") || relativePath === "sessions";
      if (!safe || entry.isSymbolicLink()) { plan.excluded.push(relativePath); continue; }
      if (entry.isDirectory()) { await visit(relativePath); continue; }
      if (!entry.isFile()) { plan.excluded.push(relativePath); continue; }
      if (relativePath.startsWith("sessions/") && !relativePath.endsWith(".jsonl")) {
        plan.excluded.push(relativePath); continue;
      }
      let conflict = false;
      try { await lstat(path.join(targetDir, relativePath)); conflict = true; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      plan.files.push({ relativePath, conflict });
    }
  };
  await visit("");
  return plan;
}
