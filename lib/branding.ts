/**
 * Local product branding.
 *
 * Keep this separate from the upstream package/repository names so syncing a
 * newer agegr/pi-web release cannot silently change the user-facing brand.
 */
export const PRODUCT_NAME = "Pilaude" as const;

import desktopPackage from "../src-tauri/pilaude-package.json";

/** Name and version of this packaged desktop distribution. */
export const APP_DISTRIBUTION_NAME = "pilaude" as const;
export const APP_REPOSITORY = "20240610ldx-hub/pilaude" as const;
export const APP_REPOSITORY_URL = `https://github.com/${APP_REPOSITORY}` as const;
export const APP_RELEASES_URL = `${APP_REPOSITORY_URL}/releases` as const;
export const APP_VERSION = desktopPackage.version;
export const APP_VERSION_DISPLAY = APP_VERSION.endsWith(".0")
  ? APP_VERSION.slice(0, -2)
  : APP_VERSION;
