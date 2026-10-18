import { homedir } from "os";

/**
 * The user's home directory, resolved at runtime rather than at build time.
 *
 * Use userHome for Pi data paths; use systemHome when authorization or display
 * must refer to the OS home independently of PI_AGENT_HOME. Both stay dynamic
 * when the result reaches a traced filesystem call or absolute path.
 *
 * Next's file tracer (@vercel/nft) statically evaluates the arguments to fs
 * calls. When it can fold an expression down to the home directory it globs
 * that directory at build time to find matching files. The diagnostic run
 * captured the patterns it issued on a Windows runner:
 *
 *     C:\Users\runneradmin/**\/*
 *     C:\Users\runneradmin\pi-cwd-*
 *
 * A Windows user profile contains legacy junctions that loop back on themselves
 * (Application Data -> AppData\Roaming, Local Settings -> AppData\Local,
 * Cookies, ...) plus WindowsApps reparse points. Enumerating them returns
 * EPERM/EACCES, which fails the webpack build outright — that is why the
 * Windows release leg had never once succeeded. macOS runs the same code and
 * never scans outside the checkout, so it only ever broke on Windows.
 *
 * Reading an env var first makes the expression dynamic, so nft stops folding
 * it. PI_AGENT_HOME is also a genuine override for anyone who wants pi's data
 * somewhere other than the real home directory.
 *
 * See .github/workflows/windows-build-debug.yml for the full diagnosis.
 */
export function userHome(): string {
  return process.env.PI_AGENT_HOME || homedir();
}

/** Keep OS home semantics for authorization and display, without folding it at build time. */
export function systemHome(): string {
  return process.env[process.platform === "win32" ? "USERPROFILE" : "HOME"] || homedir();
}
