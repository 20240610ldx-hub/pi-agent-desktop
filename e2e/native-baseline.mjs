// Windows native baseline CLI. See docs/pilaude-windows-regression.md and e2e/native-harness.mjs.
import { EXIT, HarnessError, USAGE, formatCheckList, parseArgs, runBaseline } from "./native-harness.mjs";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return EXIT.ok;
  }
  if (args.list) {
    console.log(formatCheckList());
    return EXIT.ok;
  }
  const controller = new AbortController();
  // `on`, not `once`: a second Ctrl+C during cleanup must not fall back to the default handler, which
  // ends the process without running the exit hook and would leave the dev shell tree behind.
  for (const name of ["SIGINT", "SIGBREAK", "SIGTERM"]) {
    process.on(name, () => {
      if (controller.signal.aborted) console.error(`${name} ignored: cleaning up the started processes, please wait`);
      controller.abort();
    });
  }
  const { exitCode, report, resultsFile } = await runBaseline({ ...args, signal: controller.signal });
  console.log(JSON.stringify({
    status: report.status, results: resultsFile, checks: report.checks, realApiRequests: report.realApiRequests,
    dpi: report.dpi, failure: report.failure,
  }, null, 2));
  return exitCode;
}

try {
  process.exitCode = await main();
} catch (error) {
  if (error instanceof HarnessError) {
    console.error(error.message);
    process.exitCode = error.exitCode;
  } else {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = EXIT.failed;
  }
}
