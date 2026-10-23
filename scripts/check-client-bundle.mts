// After `next build`: fails if the Anthropic API key (or anything shaped like it) is in the files a browser downloads.
// CI builds with a canary key in ANTHROPIC_API_KEY, so a leak would put that exact value into the bundle and be caught here.
import { existsSync } from "node:fs";
import { scanDirectory } from "../src/lib/security/bundle-scan.ts";

const dirs = [".next/static", "public"];
if (!existsSync(".next/static")) {
  console.error("No .next/static found. Run `npm run build` first.");
  process.exit(1);
}
let scanned = 0;
const findings = dirs.flatMap((dir) => {
  const result = scanDirectory(dir, process.env);
  scanned += result.scanned;
  return result.findings;
});
console.log(`Scanned ${scanned} client files.${process.env.ANTHROPIC_API_KEY ? " (the ANTHROPIC_API_KEY value was searched for too)" : ""}`);
if (findings.length) {
  for (const f of findings) console.error(`LEAK: ${f.what} in ${f.file}`);
  process.exit(1);
}
console.log("OK: the Anthropic key is not in the client bundle.");
