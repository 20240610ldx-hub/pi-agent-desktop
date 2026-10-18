/** Reviewed optional package sources. Classification is not installation or runtime validation. */
export interface RecommendedPiExtension {
  id: string;
  version: string;
  license: string;
  sourceUrls: readonly string[];
  status: "extension" | "built-in" | "unsupported";
  nameKey: string;
  descriptionKey: string;
  reasonKey: string;
  installSource?: `npm:${string}@${string}`;
}

function entry(id: string, version: string, license: string, key: string, status: RecommendedPiExtension["status"]): RecommendedPiExtension {
  return Object.freeze({
    id, version, license, status,
    sourceUrls: Object.freeze([`https://registry.npmjs.org/${encodeURIComponent(id)}/${version}`]),
    nameKey: `plugins.recommended.${key}.name`,
    descriptionKey: `plugins.recommended.${key}.description`,
    reasonKey: `plugins.recommended.${key}.reason`,
    ...(status === "extension" ? { installSource: `npm:${id}@${version}` as const } : {}),
  });
}

export const RECOMMENDED_PI_EXTENSIONS: readonly RecommendedPiExtension[] = Object.freeze([
  entry("@juicesharp/rpiv-todo", "2.13.9", "MIT", "todo", "extension"),
  entry("pi-web-access", "0.42.0", "MIT", "web", "extension"),
  entry("pi-powerline-footer", "0.20.2", "MIT", "footer", "unsupported"),
  entry("@gotgenes/pi-permission-system", "41.0.0", "MIT", "permissions", "extension"),
  entry("pi-subagents", "0.79.1", "MIT", "subagents", "built-in"),
  entry("@plannotator/pi-extension", "0.28.23", "MIT OR Apache-2.0", "plannotator", "extension"),
  entry("pi-background-tasks", "2.6.10", "ISC", "backgroundTasks", "unsupported"),
  entry("@narumitw/pi-usage", "0.67.0", "MIT", "usage", "built-in"),
]);

export function getRecommendedPiExtension(id: string): RecommendedPiExtension | undefined {
  return RECOMMENDED_PI_EXTENSIONS.find(item => item.id === id);
}
