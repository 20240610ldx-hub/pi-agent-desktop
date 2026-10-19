import type { LoadExtensionsResult } from "@earendil-works/pi-coding-agent";
import { dirname, isAbsolute, join } from "node:path";
import { HOST_BUILTIN_TODO_EXTENSION_PATH } from "./builtin-todo-extension.ts";
import { readRegularFileText } from "./regular-file.ts";

const TODO_PACKAGE = "@juicesharp/rpiv-todo";

function npmIdentity(spec: string): string | undefined {
  const alias = spec.match(/^(@[^/]+\/[^@]+|[^@]+)@npm:(.+)$/)?.[2];
  return (alias ?? spec).match(/^(@[^/]+\/[^@]+|[^@]+)/)?.[1];
}

function installedIdentity(path: string): string | undefined {
  if (!isAbsolute(path)) return undefined;
  let directory = dirname(path);
  // SDK attaches npm sourceInfo after extensionsOverride. Resolve only the
  // nearest package boundary for tool candidates, with bounded regular reads.
  for (let depth = 0; depth < 32; depth++) {
    try {
      const text = readRegularFileText(join(directory, "package.json"), 64 * 1024);
      if (text !== undefined) {
        const manifest: unknown = JSON.parse(text);
        return typeof manifest === "object" && manifest !== null && "name" in manifest
          && typeof manifest.name === "string" ? manifest.name : undefined;
      }
    } catch { return undefined; }
    const parent = dirname(directory);
    if (parent === directory || directory.endsWith("node_modules")) return undefined;
    directory = parent;
  }
  return undefined;
}

/** Prefer the application-owned Todo graph over an old installation of the same package. */
export function preferBuiltinTodoExtension(base: LoadExtensionsResult): LoadExtensionsResult {
  const host = base.extensions.find((extension) => extension.path === HOST_BUILTIN_TODO_EXTENSION_PATH);
  if (!host?.tools.has("todo")) return base;
  const removed = new Set(base.extensions.filter((extension) => {
    if (extension.path === host.path || !extension.tools.has("todo")) return false;
    const source = extension.sourceInfo?.source ?? "";
    // The explicit npm alias target wins over a coincidental directory/alias name.
    if (source.startsWith("npm:")) return npmIdentity(source.slice(4).trim()) === TODO_PACKAGE;
    if (source.startsWith("@")) return npmIdentity(source) === TODO_PACKAGE;
    return installedIdentity(extension.resolvedPath ?? extension.path) === TODO_PACKAGE;
  }).map((extension) => extension.path));
  if (removed.size === 0) return base;
  // SDK conflict diagnostics are recorded before extensionsOverride. Drop only
  // diagnostics for removed packages or their exact Todo conflict with the host.
  return {
    ...base,
    extensions: base.extensions.filter((extension) => !removed.has(extension.path)),
    errors: base.errors.filter((error) => !removed.has(error.path) && !(error.path === host.path
      && [...removed].some((path) => error.error === `Tool "todo" conflicts with ${path}`))),
  };
}
