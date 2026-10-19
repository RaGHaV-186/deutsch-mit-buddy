// Curriculum: German 0 → B1 (from German_0-B1_Curriculum.md + tracker adjustments).
// The app walks through SESSIONS in order. profile.session_index points at the next one.

export type SessionKind = "lesson" | "saturday" | "sunday" | "review" | "test" | "buffer";

export interface Session {
  code: string; // Z1, W3.2, SAT, SUN, R-Z7-10, ...
  kind: SessionKind;
  grammar: string;
  theme: string;
  goal?: string;
  phase: "zero" | "A1" | "A2" | "B1" | "exam";
}

const L = (code: string, grammar: string, theme: string, goal?: string): Session => ({
  code,
  kind: "lesson",
  grammar,
  theme,
  goal,
  phase: phaseOf(code),
});

function phaseOf(code: string): Session["phase"] {
  if (code.startsWith("Z")) return "zero";
  const w = Number(code.slice(1).split(".")[0]);
  if (w <= 4) return "A1";
  if (w <= 8) return "A2";
  if (w <= 13) return "B1";
  return "exam";
}

const SAT = (words: number, phase: Session["phase"]): Session => ({
  code: "SAT",
  kind: "saturday",
  grammar: "Review & writing",
  theme: `Write ${words} words on the week's themes · conversation practice · 1 Easy German episode · catch-up`,
  phase,
});

const SUN = (phase: Session["phase"], label?: string): Session => ({
  code: "SUN",
  kind: label ? "test" : "sunday",
  grammar: "Test · half day off",
  theme: label ?? "Weekly test: grammar + vocab + writing from this week's lessons",
  phase,
});

const Z: Session[] = [
  L("Z1", "Alphabet & German sounds (ä ö ü ß, ei/ie, ch, sch, z, w, v); spelling your name (buchstabieren)", "Begrüßung & Verabschiedung", "Pronounce all German letters and spell my name"),
  L("Z2", "Personal pronouns + sein; Ich heiße… / Ich bin… / Ich komme aus…", "Sich vorstellen (basic)", "Say who I am, where I'm from, how I am"),
  L("Z3", "Numbers 0–100 (einundzwanzig order), phone numbers, age", "Zahlen & Kontaktdaten", "Say and understand numbers, my phone number, my age"),
  L("Z4", "Regular verbs in Präsens (wohnen, lernen, arbeiten, spielen) + all endings", "Wohnort & Studium", "Talk about where I live, what I study, what I do"),
  L("Z5", "haben; nouns have gender: der/die/das, ein/eine; plural intro", "Dinge im Alltag", "Name everyday objects with the right article"),
  L("Z6", "W-questions (wer, was, wo, woher, wie, wann) + yes/no questions (verb first)", "Kennenlernen – Fragen stellen", "Ask and answer simple personal questions"),
  L("Z7", "Word order: verb always in position 2 (Heute lerne ich…)", "Tage, Monate, Jahreszeiten", "Build sentences with correct verb-second order"),
  L("Z8", "Telling time (formal + informal), am / um", "Tagesablauf (basic)", "Tell the time and say when I do things"),
  L("Z9", "Irregular Präsens (fahren, essen, sprechen, lesen, nehmen, sehen) + möchten", "Essen & Trinken, im Café bestellen", "Order food and drinks, say what I eat/drink"),
  L("Z10", "du vs Sie; review of Z1–Z9; short dialogues", "Im Café / Small talk", "Hold a 2-minute formal and informal introduction dialogue"),
];

// Main phase lessons W1.1 – W16.5, in order.
const W: [string, string, string][] = [
  ["W1.1", "Präsens (regular + sein/haben), W-questions, verb-2nd word order — consolidation", "Sich vorstellen"],
  ["W1.2", "Articles; Nominativ vs Akkusativ", "Familie"],
  ["W1.3", "Negation: nicht vs kein", "Wohnung"],
  ["W1.4", "Modal verbs I: können, müssen, wollen, dürfen", "Essen & Trinken"],
  ["W1.5", "Separable verbs (aufstehen, einkaufen…)", "Tagesablauf"],
  ["W2.1", "Dativ articles", "Einkaufen"],
  ["W2.2", "Dativ verbs: helfen, gefallen, gehören, danken", "Kleidung"],
  ["W2.3", "Possessive articles in Nom/Akk/Dat", "In der Stadt"],
  ["W2.4", "Personal pronouns Akk + Dat", "Wegbeschreibung"],
  ["W2.5", "Imperativ (du/ihr/Sie)", "Termine & Uhrzeit"],
  ["W3.1", "Perfekt with haben", "Wochenende"],
  ["W3.2", "Perfekt with sein", "Freizeit"],
  ["W3.3", "Irregular Partizip II (top 40)", "Reisen"],
  ["W3.4", "Perfekt: separable/inseparable verbs", "Arbeit"],
  ["W3.5", "Time expressions: am, um, im, seit, vor", "Feste & Feiern"],
  ["W4.1", "Prepositions + Akkusativ (für, durch, ohne, gegen, um)", "Möbel & Wohnen"],
  ["W4.2", "Prepositions + Dativ (aus, bei, mit, nach, seit, von, zu)", "Umzug"],
  ["W4.3", "Wechselpräpositionen: Wo? vs Wohin?", "Verkehr & ÖPNV"],
  ["W4.4", "stellen/stehen, legen/liegen, hängen", "Behörden & Anmeldung"],
  ["W4.5", "A1 grammar review", "Review all themes"],
  ["W5.1", "Präteritum: sein & haben", "Kindheit"],
  ["W5.2", "Präteritum: modal verbs", "Gesundheit"],
  ["W5.3", "Nebensatz: weil (verb at end)", "Beim Arzt"],
  ["W5.4", "Nebensatz: dass", "Schule & Ausbildung"],
  ["W5.5", "Nebensatz: wenn vs als", "Erinnerungen"],
  ["W6.1", "Indirect questions: ob + W-word", "Körper"],
  ["W6.2", "Reflexive verbs (Akkusativ)", "Gefühle"],
  ["W6.3", "Reflexive verbs (Dativ): sich die Hände waschen", "Hobbys"],
  ["W6.4", "Verbs with prepositions (warten auf, sich freuen auf/über)", "Medien"],
  ["W6.5", "da- and wo- compounds (darauf, worauf)", "Kommunikation & Handy"],
  ["W7.1", "Komparativ", "Produkte vergleichen"],
  ["W7.2", "Superlativ", "Wetter & Klima"],
  ["W7.3", "Vergleiche: als / wie", "Natur"],
  ["W7.4", "Adjective endings after der/die/das", "Mode"],
  ["W7.5", "Adjective endings after ein/kein/mein", "Urlaub"],
  ["W8.1", "Adjective endings without article", "Beruf"],
  ["W8.2", "Genitiv basics", "Bewerbung"],
  ["W8.3", "Connectors: deshalb, trotzdem, sonst", "Im Büro"],
  ["W8.4", "Temporal prepositions: vor, nach, während, bis", "Wohnungssuche"],
  ["W8.5", "A2 grammar review", "Review all themes"],
  ["W9.1", "Relative clauses: Nominativ + Akkusativ", "Menschen beschreiben"],
  ["W9.2", "Relative clauses: Dativ + with prepositions", "Wünsche & Träume"],
  ["W9.3", "Konjunktiv II: würde / wäre / hätte", "Umwelt"],
  ["W9.4", "Konjunktiv II: Ratschläge (sollte, könnte)", "Zukunft"],
  ["W9.5", "Irreal conditions: Wenn ich … wäre, würde ich …", "Stadt vs Land"],
  ["W10.1", "Passiv Präsens", "Technik"],
  ["W10.2", "Passiv Präteritum + Passiv mit Modalverb", "Produktion & Industrie"],
  ["W10.3", "Infinitiv mit zu", "Nachhaltigkeit"],
  ["W10.4", "Final clauses: um … zu / damit", "Studium"],
  ["W10.5", "statt … zu / ohne … zu", "Ziele & Pläne"],
  ["W11.1", "Plusquamperfekt", "Geschichte"],
  ["W11.2", "nachdem / bevor / während", "Lebenslauf"],
  ["W11.3", "seit(dem) / bis / sobald", "Pläne"],
  ["W11.4", "Futur I", "Gesellschaft"],
  ["W11.5", "n-Deklination (der Kunde, den Kunden)", "Nachrichten"],
  ["W12.1", "obwohl vs trotzdem", "Meinung äußern"],
  ["W12.2", "sowohl…als auch, weder…noch, entweder…oder", "Diskussion & Argumente"],
  ["W12.3", "je … desto", "Arbeitswelt"],
  ["W12.4", "Nomen-Verb-Verbindungen (eine Entscheidung treffen)", "Konsum"],
  ["W12.5", "Genitive prepositions: wegen, trotz, während, innerhalb", "Kultur & Freizeit"],
  ["W13.1", "lassen (+ Infinitiv)", "Beschwerde"],
  ["W13.2", "Partizip I/II as adjective", "Anfrage"],
  ["W13.3", "Indirect speech basics (Er sagt, dass…)", "Einladung"],
  ["W13.4", "Formal letter structure", "Entschuldigung"],
  ["W13.5", "Semi-formal email phrases", "Termin verschieben"],
  ["W14.1", "Exam: Lesen Teil 1–2 strategies + practice", "—"],
  ["W14.2", "Exam: Lesen Teil 3–5", "—"],
  ["W14.3", "Exam: Hören Teil 1–2", "—"],
  ["W14.4", "Exam: Hören Teil 3–4", "—"],
  ["W14.5", "Exam: Schreiben Aufgabe 1 (informal email, ~80 words)", "—"],
  ["W15.1", "Exam: Schreiben Aufgabe 2 (forum opinion, ~80 words)", "—"],
  ["W15.2", "Exam: Schreiben Aufgabe 3 (formal email, ~40 words)", "—"],
  ["W15.3", "Exam: Sprechen Teil 1 (gemeinsam etwas planen)", "—"],
  ["W15.4", "Exam: Sprechen Teil 2 (Präsentation)", "—"],
  ["W15.5", "Exam: Sprechen Teil 3 (Feedback & Fragen)", "—"],
  ["W16.1", "Full Lesen mock (timed) + error review", "—"],
  ["W16.2", "Full Hören mock (timed) + error review", "—"],
  ["W16.3", "Full Schreiben mock (timed) + error review", "—"],
  ["W16.4", "Full Sprechen mock (voice mode) + error review", "—"],
  ["W16.5", "Weak-point repair day (from mistake log)", "—"],
];
const Wl = Object.fromEntries(W.map(([c, g, t]) => [c, L(c, g, t)]));

// Sunday checkpoints, keyed by the lesson that precedes that weekend.
const CHECKPOINTS: Record<string, string> = {
  "W1.3": "ZERO CHECKPOINT: mini test on Z1–Z10 (≥60% to continue)",
  "W5.3": "CHECKPOINT A1 mock (Start Deutsch 1 format, ≥60%)",
  "W9.3": "CHECKPOINT A2 mock (Goethe A2 format, ≥60%)",
  "W13.3": "CHECKPOINT B1 half-mock: Lesen + Schreiben (≥60%)",
};

function build(): Session[] {
  const out: Session[] = [];
  // Zero phase as actually run (tracker): Z1–Z6, review, test, Z7–Z10, review, test.
  out.push(...Z.slice(0, 6));
  out.push({ code: "R1", kind: "review", grammar: "Review & writing (Z1–Z6)", theme: "Error clinic + 40-word writing", phase: "zero" });
  out.push({ code: "T1", kind: "test", grammar: "Week 1 test (Z1–Z6)", theme: "Zahlen · Verben · Artikel · Fragen · Schreiben · Sprechen", phase: "zero" });
  out.push(...Z.slice(6, 10));
  out.push({ code: "R2", kind: "review", grammar: "Review & writing (Z7–Z10)", theme: "Error clinic + 40-word writing", phase: "zero" });
  out.push({ code: "T2", kind: "test", grammar: "Week 2 test (Z7–Z10)", theme: "Word order · time · irregular verbs · du/Sie · Schreiben · Sprechen", phase: "zero" });

  // Main phase: follows the curriculum calendar's weekday rhythm (W1.1–W1.3, weekend, then 5 lessons per weekend).
  const order = W.map((w) => w[0]);
  const groups: string[][] = [order.slice(0, 3)];
  for (let i = 3; i < order.length; i += 5) groups.push(order.slice(i, i + 5));
  for (const g of groups) {
    for (const code of g) out.push(Wl[code]);
    const last = g[g.length - 1];
    const ph = Wl[last].phase;
    const wk = Number(last.slice(1).split(".")[0]);
    const words = wk <= 4 ? 80 : wk <= 8 ? 120 : 150;
    out.push(SAT(words, ph));
    out.push(SUN(ph, CHECKPOINTS[last]));
  }
  // Remove the trailing weekend after W16.5 and add buffers + final mock.
  out.splice(out.length - 2, 2);
  for (let i = 0; i < 3; i++) out.push({ code: "BUF", kind: "buffer", grammar: "Catch-up / repeat weakest lesson", theme: "—", phase: "exam" });
  out.push(SAT(150, "exam"));
  out.push(SUN("exam", "FINAL: full B1 mock, all 4 modules (≥60% per module)"));
  return out;
}

export const SESSIONS: Session[] = build();

/** Index of the first session with this code (for seeding the pointer). */
export function indexOfCode(code: string) {
  return SESSIONS.findIndex((s) => s.code === code);
}

export function sessionLabel(s: Session) {
  if (s.kind === "lesson") return `${s.code} · ${s.grammar}`;
  return `${s.grammar}${s.theme && s.theme !== "—" ? " · " + s.theme : ""}`;
}

export const A1_DONE_CODE = "W5.3"; // A1 mock follows this lesson

export const CURRICULUM_RULES = `
Structure: Zero phase (Z1–Z10, taught in English with pronunciation help) → main phase W1.1–W16.5 (one grammar point per weekday) → Saturdays = review, longer writing, conversation, catch-up → Sundays = test + half day off; checkpoints on Sundays after blocks (pass mark 60%; failing = repeat weakest lessons first).
Targets: solid A1 by mid-Nov, A2 by mid/late Jan, B1 exam window March–April 2027.
Writing length: 3–5 sentences (zero phase) → 8 sentences (W1–4) → 60 words (W5–8) → 100 words (W9–13) → exam tasks (W14–16).
Rules: targets are minimums, unfinished work carries over, never skipped. Missing 2 days → next Saturday is catch-up. Bad day minimum = 20 min review + flashcards (don't advance). From W3: one real conversation per week (Tandem app, Sprachcafé, Stammtisch).
`.trim();
