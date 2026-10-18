import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const tauriCli = require.resolve("@tauri-apps/cli/tauri.js");
const desktopApiToken = randomBytes(32).toString("hex");

const child = spawn(process.execPath, [tauriCli, "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: {
    ...process.env,
    PI_DESKTOP_API_TOKEN: desktopApiToken,
    ...(process.platform === "win32" ? {
      PILAUDE_CREDENTIAL_HELPER: fileURLToPath(new URL("../src-tauri/target/debug/pi-agent-desktop.exe", import.meta.url)),
    } : {}),
  },
});

child.once("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
