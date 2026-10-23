import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Looks through the files a browser can download (.next/static after `next build`) for the Anthropic API key.
// Relative imports only: scripts/check-client-bundle.mts runs this file with plain Node.

export interface Finding {
  file: string;
  what: string;
}

/** What must never appear in client code: key-shaped strings, the variable's name, and the key's own value. */
export function secretPatterns(env: Record<string, string | undefined>): { what: string; test: (text: string) => boolean }[] {
  const value = env.ANTHROPIC_API_KEY;
  const patterns: { what: string; test: (text: string) => boolean }[] = [
    { what: "a string shaped like an Anthropic key (sk-ant-…)", test: (t) => /sk-ant-[A-Za-z0-9_-]{8,}/.test(t) },
    { what: "the name ANTHROPIC_API_KEY", test: (t) => t.includes("ANTHROPIC_API_KEY") },
  ];
  if (value && value.length >= 8) patterns.push({ what: "the value of ANTHROPIC_API_KEY", test: (t) => t.includes(value) });
  return patterns;
}

const TEXT_FILE = /\.(js|mjs|cjs|css|html|json|map|txt|rsc)$/;

function* walk(dir: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) yield* walk(path);
    else if (TEXT_FILE.test(name) && stat.size < 20_000_000) yield path;
  }
}

export function scanDirectory(dir: string, env: Record<string, string | undefined>): { scanned: number; findings: Finding[] } {
  const patterns = secretPatterns(env);
  const findings: Finding[] = [];
  let scanned = 0;
  for (const file of walk(dir)) {
    scanned += 1;
    const text = readFileSync(file, "utf8");
    for (const p of patterns) if (p.test(text)) findings.push({ file, what: p.what });
  }
  return { scanned, findings };
}
