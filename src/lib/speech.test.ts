import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NORMAL_RATE, pickGermanVoice, scoreVoice, SLOW_RATE, speak } from "./speech";

const voice = (name: string, lang: string, localService = true) => ({ name, lang, localService }) as SpeechSynthesisVoice;

describe("voice choice", () => {
  it("ignores non-German voices", () => {
    expect(scoreVoice(voice("Samantha", "en-US"))).toBe(-1);
    expect(pickGermanVoice([voice("Samantha", "en-US")])).toBeNull();
    expect(pickGermanVoice([])).toBeNull();
  });

  it("prefers de-DE over other German, and on-device over network voices (they work offline)", () => {
    const at = voice("Anna AT", "de-AT");
    const net = voice("Google Deutsch", "de-DE", false);
    const local = voice("Anna", "de-DE", true);
    expect(pickGermanVoice([at, net, local])).toBe(local);
    expect(pickGermanVoice([at, net])).toBe(net);
    expect(pickGermanVoice([at])).toBe(at);
  });

  it("accepts underscore language tags and prefers enhanced voices", () => {
    const plain = voice("Markus", "de_DE");
    const enhanced = voice("Markus (Enhanced)", "de_DE");
    expect(pickGermanVoice([plain, enhanced])).toBe(enhanced);
  });
});

describe("speak", () => {
  const utterances: { text: string; rate?: number; voice?: unknown; lang?: string }[] = [];
  const synth = {
    voices: [] as SpeechSynthesisVoice[],
    getVoices() {
      return this.voices;
    },
    cancel: vi.fn(),
    speak: vi.fn((u) => utterances.push(u)),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  beforeEach(() => {
    utterances.length = 0;
    synth.voices = [voice("Anna", "de-DE")];
    synth.cancel.mockClear();
    synth.speak.mockClear();
    vi.stubGlobal("speechSynthesis", synth);
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        constructor(public text: string) {}
        rate?: number;
        voice?: unknown;
        lang?: string;
      },
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("speaks with the German voice at normal and slow speed, cancelling what was playing", async () => {
    expect(await speak("der Hund")).toBe("spoken");
    expect(await speak("der Hund", { slow: true })).toBe("spoken");
    expect(synth.cancel).toHaveBeenCalledTimes(2);
    expect(utterances[0]).toMatchObject({ text: "der Hund", rate: NORMAL_RATE, lang: "de-DE" });
    expect(utterances[1].rate).toBe(SLOW_RATE);
    expect(SLOW_RATE).toBeLessThan(NORMAL_RATE);
  });

  it("says so when the device has no German voice, and stays quiet", async () => {
    vi.useFakeTimers();
    synth.voices = [voice("Samantha", "en-US")];
    expect(await speak("Hallo")).toBe("no-voice");
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it("waits briefly for voices that load late", async () => {
    vi.useFakeTimers();
    synth.voices = [];
    const result = speak("Hallo");
    synth.voices = [voice("Anna", "de-DE")];
    await vi.advanceTimersByTimeAsync(1600);
    expect(await result).toBe("spoken");
  });

  it("reports unsupported browsers", async () => {
    vi.unstubAllGlobals();
    expect(await speak("Hallo")).toBe("unsupported");
  });
});
