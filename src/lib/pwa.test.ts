import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { decodePng } from "./png";
import { PWA } from "./pwa";

const publicFile = (url: string) => `public${url}`;

describe("web app manifest", () => {
  const m = manifest();

  it("matches the brief", () => {
    expect(m).toMatchObject({
      name: "Deutsch mit Buddy",
      short_name: "Buddy",
      display: "standalone",
      theme_color: "#5E6875",
      background_color: "#F2F3F5",
      start_url: "/home",
    });
  });

  it("has 192 and 512 icons plus a 512 maskable one, all from the light Buddy icon", () => {
    const icons = m.icons!;
    expect(icons.map((i) => [i.sizes, i.purpose ?? "any"])).toEqual([
      ["192x192", "any"],
      ["512x512", "any"],
      ["512x512", "maskable"],
    ]);
    for (const icon of icons) expect(icon.src).toMatch(/^\/buddy\/buddy-icon-light-(192|512)\.png$/);
  });

  it("every icon file exists and really has the size it claims, with no transparency", () => {
    for (const icon of m.icons!) {
      const file = publicFile(icon.src);
      expect(existsSync(file), file).toBe(true);
      const png = decodePng(readFileSync(file));
      const [w, h] = icon.sizes!.split("x").map(Number);
      expect([png.width, png.height], file).toEqual([w, h]);
      expect(png.hasAlpha, `${file} must be opaque so masks and the home screen don't show black corners`).toBe(false);
    }
  });
});

describe("home-screen and browser icons", () => {
  it("apple-touch-icon is the 180px light icon", () => {
    expect(PWA.appleTouchIcon).toBe("/buddy/buddy-icon-light-180.png");
    const png = decodePng(readFileSync(publicFile(PWA.appleTouchIcon)));
    expect([png.width, png.height, png.hasAlpha]).toEqual([180, 180, false]);
  });

  it("favicon is Buddy's glyph (SVG), with a legacy favicon.ico made from it", () => {
    expect(PWA.favicon).toBe("/buddy/buddy-glyph.svg");
    expect(readFileSync(publicFile(PWA.favicon), "utf8")).toContain("<svg");
    const ico = readFileSync("src/app/favicon.ico");
    expect(ico.readUInt16LE(2)).toBe(1); // ICO type
    expect(ico.readUInt16LE(4)).toBeGreaterThanOrEqual(1); // image count
  });

  it("the old generated icons are gone", () => {
    expect(existsSync("public/icons")).toBe(false);
  });
});

describe("maskable safe zone", () => {
  // Android crops maskable icons to a shape; only the central circle (80% of the width) is guaranteed to stay visible.
  it("Buddy's head and ears sit inside the central 80% circle", () => {
    const maskable = PWA.icons.find((i) => "purpose" in i && i.purpose === "maskable")!;
    const { width, height, rgba } = decodePng(readFileSync(publicFile(maskable.src)));
    const bg = [rgba[0], rgba[1], rgba[2]];
    const safeRadius = 0.4 * width;
    let headPixels = 0;
    let outside = 0;
    let farthest = 0;
    for (let y = 0; y < height * 0.62; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const differs = Math.abs(rgba[i] - bg[0]) + Math.abs(rgba[i + 1] - bg[1]) + Math.abs(rgba[i + 2] - bg[2]) >= 24;
        if (!differs) continue;
        headPixels++;
        const d = Math.hypot(x - width / 2, y - height / 2);
        farthest = Math.max(farthest, d);
        if (d > safeRadius) outside++;
      }
    }
    expect(headPixels).toBeGreaterThan(20000); // the head really was found
    expect(outside).toBe(0);
    expect(farthest).toBeLessThanOrEqual(safeRadius);
  });
});
