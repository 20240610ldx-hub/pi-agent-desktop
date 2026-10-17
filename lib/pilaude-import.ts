import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, copyFile, realpath, writeFile } from "node:fs/promises";
import { constants, createReadStream } from "node:fs";
import path from "node:path";
import { planPiImport, type ImportPlan } from "./pilaude-data";
import { stripJsonComments } from "./jsonc";

interface ImportPreview extends ImportPlan {
  digest: string;
  warnings: string[];
}

async function fileDigest(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

/** Resolve aliases even when the selected destination has not been created. */
async function canonicalDirectory(directory: string): Promise<string> {
  let existing = path.resolve(directory);
  const tail: string[] = [];
  for (;;) {
    try { return path.join(await realpath(existing), ...tail.reverse()); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = path.dirname(existing);
      if (parent === existing) throw error;
      tail.push(path.basename(existing)); existing = parent;
    }
  }
}

/** Reject links in every component beneath either explicitly selected root. */
async function assertNoLinks(root: string, relativePath = ""): Promise<void> {
  let current = root;
  for (const part of ["", ...relativePath.split("/").filter(Boolean)]) {
    current = path.join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error("Import does not follow directory or file links.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
  }
}

function sanitizeConfig(relativePath: string, bytes: Buffer, warnings: string[]): Buffer {
  let config: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(stripJsonComments(bytes.toString("utf8").replace(/^\uFEFF/, "")));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected an object");
    config = parsed as Record<string, unknown>;
  } catch { throw new Error(`Cannot import malformed ${relativePath}. The original was preserved.`); }

  const remove = (object: Record<string, unknown>, fields: string[]) => {
    for (const field of fields) {
      if (field in object) { delete object[field]; warnings.push(`${relativePath}: ${field}`); }
    }
  };
  if (relativePath === "settings.json") {
    remove(config, ["packages", "extensions", "skills", "prompts", "themes", "shellPath", "shellCommandPrefix", "sessionDir", "defaultProjectTrust", "defaultTools", "mcpServers", "mcp"]);
  } else {
    const visit = (value: unknown) => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) { value.forEach(visit); return; }
      const object = value as Record<string, unknown>;
      remove(object, ["apiKey", "headers", "oauth", "accessToken", "refreshToken", "clientSecret"]);
      if (typeof object.baseUrl === "string") {
        try {
          const url = new URL(object.baseUrl);
          if (url.username || url.password || url.search) remove(object, ["baseUrl"]);
        } catch { /* Pi will validate incomplete non-secret configuration. */ }
      }
      Object.values(object).forEach(visit);
    };
    visit(config.providers);
  }
  return Buffer.from(JSON.stringify(config, null, 2));
}

async function collectImport(sourceDir: string, targetDir: string) {
  await assertNoLinks(path.resolve(sourceDir)); await assertNoLinks(path.resolve(targetDir));
  const source = await canonicalDirectory(sourceDir); const target = await canonicalDirectory(targetDir);
  const contains = (root: string, candidate: string) => {
    const relative = path.relative(root, candidate);
    return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
  };
  if (contains(source, target) || contains(target, source)) {
    throw new Error("Import source and target must be separate directories.");
  }
  await assertNoLinks(source); await assertNoLinks(target);
  const plan = await planPiImport(source, target);
  plan.files.sort((a, b) => a.relativePath.localeCompare(b.relativePath)); plan.excluded.sort();
  const warnings: string[] = [];
  const contents = new Map<string, { bytes?: Buffer; hash: string }>();
  const digest = createHash("sha256").update(JSON.stringify(plan));
  for (const file of plan.files) {
    await assertNoLinks(source, file.relativePath); await assertNoLinks(target, file.relativePath);
    const sourceFile = path.join(source, file.relativePath);
    const hash = await fileDigest(sourceFile);
    digest.update(file.relativePath).update(hash);
    contents.set(file.relativePath, {
      hash,
      bytes: file.relativePath.endsWith(".jsonl") ? undefined : sanitizeConfig(file.relativePath, await readFile(sourceFile), warnings),
    });
  }
  return { preview: { ...plan, digest: digest.digest("hex"), warnings: [...new Set(warnings)] } as ImportPreview, contents };
}

export async function previewPiImport(source: string, target: string): Promise<ImportPreview> {
  return (await collectImport(source, target)).preview;
}

/** Explicit copy only. No source writes, no overwrite, no installation or code evaluation. */
export async function executePiImport(source: string, target: string, digest: string) {
  const { preview, contents } = await collectImport(source, target);
  if (digest !== preview.digest) throw new Error("Import source or conflicts changed. Review a new preview first.");
  const backupRelative = `import-backups/${randomUUID()}`;
  await assertNoLinks(preview.targetDir, backupRelative);
  const backupDir = path.join(preview.targetDir, backupRelative);
  const imported: string[] = [];
  const skipped = preview.files.filter(file => file.conflict).map(file => file.relativePath);
  const candidates = preview.files.filter(file => !file.conflict);
  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  // Every candidate has a complete sanitized recovery copy before publishing begins.
  for (const file of candidates) {
    const destination = path.join(backupDir, file.relativePath);
    await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    const content = contents.get(file.relativePath)!;
    if (content.bytes) await writeFile(destination, content.bytes, { flag: "wx", mode: 0o600 });
    else {
      await assertNoLinks(preview.sourceDir, file.relativePath);
      await copyFile(path.join(preview.sourceDir, file.relativePath), destination, constants.COPYFILE_EXCL);
      if (await fileDigest(destination) !== content.hash) throw new Error("Import source changed while backing up. Review a new preview first.");
    }
  }
  const manifest = path.join(backupDir, "manifest.json");
  await writeFile(manifest, JSON.stringify({ ...preview, imported, skipped, state: "prepared" }, null, 2), { flag: "wx", mode: 0o600 });
  try {
    for (const file of candidates) {
      await assertNoLinks(preview.targetDir, file.relativePath);
      const destination = path.join(preview.targetDir, file.relativePath);
      await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
      await assertNoLinks(preview.targetDir, file.relativePath);
      try {
        await copyFile(path.join(backupDir, file.relativePath), destination, constants.COPYFILE_EXCL);
        imported.push(file.relativePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        skipped.push(file.relativePath);
      }
    }
    await writeFile(manifest, JSON.stringify({ ...preview, imported, skipped, state: "completed" }, null, 2));
    return { imported, skipped, backupDir };
  } catch {
    // Retain complete backups and the partial result, without deleting live files.
    await writeFile(manifest, JSON.stringify({ ...preview, imported, skipped, state: "interrupted" }, null, 2));
    throw new Error(`Import interrupted. Existing files were preserved; recovery copies are in ${backupDir}.`);
  }
}
