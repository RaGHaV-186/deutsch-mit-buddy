import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanDirectory, secretPatterns } from "./bundle-scan";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "bundle-"));
  mkdirSync(join(dir, "chunks"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));
const plant = (name: string, text: string) => writeFileSync(join(dir, "chunks", name), text);

describe("bundle scan", () => {
  it("passes a clean bundle", () => {
    plant("a.js", "console.log('hello', process.env.NEXT_PUBLIC_SUPABASE_URL)");
    plant("b.css", "body{color:red}");
    expect(scanDirectory(dir, {})).toEqual({ scanned: 2, findings: [] });
  });

  it("catches a key-shaped string, the variable name, and the key's own value", () => {
    plant("a.js", "const k='sk-ant-api03-abcdefghijklmnop';");
    plant("b.js", "const n='ANTHROPIC_API_KEY';");
    plant("c.js", "const v='my-secret-value-12345';");
    const { findings } = scanDirectory(dir, { ANTHROPIC_API_KEY: "my-secret-value-12345" });
    expect(findings.map((f) => f.what).sort()).toEqual(
      ["a string shaped like an Anthropic key (sk-ant-…)", "the name ANTHROPIC_API_KEY", "the value of ANTHROPIC_API_KEY"].sort(),
    );
  });

  it("finds it in source maps and HTML too, and in nested folders", () => {
    mkdirSync(join(dir, "chunks", "deep"));
    writeFileSync(join(dir, "chunks", "deep", "x.js.map"), '{"sourcesContent":["ANTHROPIC_API_KEY"]}');
    writeFileSync(join(dir, "index.html"), "<script>sk-ant-oat01-zzzzzzzzzzzz</script>");
    expect(scanDirectory(dir, {}).findings).toHaveLength(2);
  });

  it("ignores a missing folder and does not treat a very short env value as a needle", () => {
    expect(scanDirectory(join(dir, "nope"), {})).toEqual({ scanned: 0, findings: [] });
    expect(secretPatterns({ ANTHROPIC_API_KEY: "abc" })).toHaveLength(2);
    expect(secretPatterns({ ANTHROPIC_API_KEY: "abcdefghij" })).toHaveLength(3);
  });
});

describe("the Anthropic key stays on the developer's machine", () => {
  const files = (root: string): string[] =>
    readdirSync(root).flatMap((n) => {
      const p = join(root, n);
      return statSync(p).isDirectory() ? files(p) : [p];
    });

  it("no app code imports the SDK (only the maintenance scripts and tests may)", () => {
    const offenders = files("src").filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes(".test.") && readFileSync(f, "utf8").includes("@anthropic-ai/sdk"));
    expect(offenders).toEqual([]);
  });

  it("the SDK is a devDependency, not a runtime one", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.devDependencies["@anthropic-ai/sdk"]).toBeDefined();
    expect(pkg.dependencies?.["@anthropic-ai/sdk"]).toBeUndefined();
  });

  it("the key is never exposed to the browser: no NEXT_PUBLIC variable for it, and next.config exposes no env", () => {
    const example = readFileSync(".env.example", "utf8");
    expect(example).toMatch(/^ANTHROPIC_API_KEY=/m);
    expect(example).not.toMatch(/NEXT_PUBLIC_ANTHROPIC/);
    const config = readFileSync("next.config.ts", "utf8");
    expect(config).not.toMatch(/\benv\s*:/);
    expect(config).not.toContain("ANTHROPIC");
    for (const f of files("src").filter((p) => /\.(ts|tsx)$/.test(p) && !p.includes(".test."))) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/NEXT_PUBLIC_ANTHROPIC/);
    }
  });

  it("CI builds with a canary key and then scans the bundle for it", () => {
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(ci).toContain("ANTHROPIC_API_KEY: sk-ant-ci-canary");
    expect(ci).toContain("npm run check:bundle");
    expect(ci.indexOf("npm run build")).toBeLessThan(ci.indexOf("npm run check:bundle"));
  });
});
