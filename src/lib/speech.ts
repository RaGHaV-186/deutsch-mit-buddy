// Browser German voice for now (slice 6 swaps in Buddy's neural voice behind the same speak()).

export const NORMAL_RATE = 0.9;
export const SLOW_RATE = 0.55;

export type SpeakResult = "spoken" | "no-voice" | "unsupported";

const VOICE_WAIT_MS = 1500;

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/**
 * Higher is better. Prefers de-DE, a voice stored on the device (it keeps working offline; network voices don't),
 * and the better-sounding named/enhanced ones.
 */
export function scoreVoice(voice: Pick<SpeechSynthesisVoice, "lang" | "localService" | "name">): number {
  const lang = voice.lang.replace("_", "-").toLowerCase();
  if (!lang.startsWith("de")) return -1;
  let score = 1;
  if (lang === "de-de") score += 10;
  if (voice.localService) score += 5;
  if (/premium|enhanced|natural/i.test(voice.name)) score += 3;
  if (/anna|markus|petra|viktoria|google deutsch/i.test(voice.name)) score += 1;
  return score;
}

export function pickGermanVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = 0;
  for (const voice of voices) {
    const score = scoreVoice(voice);
    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }
  return best;
}

/** Voices load asynchronously in most browsers; wait briefly for the list instead of failing on the first tap. */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length > 0) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener("voiceschanged", done);
      clearTimeout(timer);
      resolve(synth.getVoices());
    };
    const timer = setTimeout(done, VOICE_WAIT_MS);
    synth.addEventListener("voiceschanged", done);
  });
}

export async function hasGermanVoice(): Promise<boolean> {
  if (!isSpeechSupported()) return false;
  return pickGermanVoice(await loadVoices()) !== null;
}

/** Speaks German text. Call from a tap handler (iOS only allows speech after a user gesture). */
export async function speak(text: string, options: { slow?: boolean } = {}): Promise<SpeakResult> {
  if (!isSpeechSupported()) return "unsupported";
  const voice = pickGermanVoice(await loadVoices());
  if (!voice) return "no-voice";
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = options.slow ? SLOW_RATE : NORMAL_RATE;
  synth.speak(utterance);
  return "spoken";
}

export function stopSpeaking() {
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}
