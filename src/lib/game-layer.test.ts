import { describe, expect, it } from "vitest";
import { GAME_PREVIEW, gameDataForHome, isGameLayerOn } from "./game-layer";

describe("isGameLayerOn", () => {
  it("is off in production and on in development when the flag is not set", () => {
    expect(isGameLayerOn({ nodeEnv: "production" })).toBe(false);
    expect(isGameLayerOn({ nodeEnv: "development" })).toBe(true);
    expect(isGameLayerOn({ nodeEnv: "test" })).toBe(true);
  });

  it("an explicit flag wins, in either direction", () => {
    for (const on of ["1", "true", "TRUE", " 1 "]) expect(isGameLayerOn({ flag: on, nodeEnv: "production" })).toBe(true);
    for (const off of ["0", "false", "False"]) expect(isGameLayerOn({ flag: off, nodeEnv: "development" })).toBe(false);
  });

  it("an unknown or empty flag value falls back to the default", () => {
    expect(isGameLayerOn({ flag: "", nodeEnv: "production" })).toBe(false);
    expect(isGameLayerOn({ flag: "maybe", nodeEnv: "production" })).toBe(false);
    expect(isGameLayerOn({ flag: "maybe", nodeEnv: "development" })).toBe(true);
  });
});

describe("gameDataForHome", () => {
  it("gives nothing when off, and clearly marked preview data when on", () => {
    expect(gameDataForHome(false)).toBeNull();
    expect(gameDataForHome(true)).toBe(GAME_PREVIEW);
    expect(GAME_PREVIEW.preview).toBe(true);
    expect(GAME_PREVIEW.week).toHaveLength(7);
  });
});
