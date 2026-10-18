import { writeFileSync } from "node:fs";

// A !command probe shared by route tests: no dependency on a Unix `touch`.
writeFileSync(process.argv[2], "");
process.stdout.write("probe\n");
