// Starter data imported from german_tracker.md (state after Day 10, 17 Oct 2026).

export const SEED_PROFILE = {
  day_count: 10, // days closed so far; next lesson is Day 11
  start_date: "2026-09-30",
  next_code: "Z9",
};

export const SEED_LOGS: { day: number; code: string; done_on: string; covered: string; mistakes: string; carry_over: string }[] = [
  { day: 1, code: "Z1", done_on: "2026-10-04", covered: "alphabet + 12 sound rules, buchstabieren, 15 greeting words, Bürgeramt dialogue (writing), voice drill 5/5, 15 cards, Nicos Weg \"Hallo!\" 31/35", mistakes: "letter name vs sound; umlauts unrounded (ö/ü) or dots dropped; ee = \"ay\" not \"ee\"; back ch said as k; final d→t (Wald); u = \"oo\"; noun capitals (Morgen); \"Ihnen\" spelling; comma/question-mark punctuation", carry_over: "recycle umlauts + ch + final d in Day 2 review" },
  { day: 2, code: "Z2", done_on: "2026-10-05", covered: "Day 1 weak-spot review 30/31, personal pronouns + sein, Ich heiße / Ich komme aus / Ich bin + feelings, 15 words with article + plural (articles 22/22), writing 6/6 after corrections, speaking drill + 5 questions, flashcard deck with audio", mistakes: "wir \"seind\" → sind (sind vs seid); ich kommen/heißen → ich komme/heiße; noun capitals dropped (student, stadt, land); umlaut dropped (madchen); missing end punctuation; \"die Sprachen\" for singular; \"Ich bin gut\" for \"I'm fine\"; \"ja Ich\" → \"Ja, ich\"; informal \"Wie geht's?\" answered with \"und Ihnen?\"", carry_over: "recycle ich → -e, sind vs seid, noun capitals + punctuation" },
  { day: 3, code: "Z3", done_on: "2026-10-06", covered: "numbers 0–100 (13–19, tens, einundzwanzig order, phone numbers in pairs, zwo, age), article patterns, 15 contact-data words, Bürgeramt writing + rewrite, speaking, 20 cards added", mistakes: "sentence-start lowercase + missing full stops; space before . / ?; fünf dots dropped; ei/ie mix (drie, drießig); -zing for -zig; zwenzig, twolf; Telefonummer / Postleizahl / Hausnummber; ihr written as Ihre; read dreiundsechzig as 62; das Mädchen komme → kommt", carry_over: "sentence frame, ei vs ie, -zig, fünf, Telefonnummer, ihr vs Ihre, mein/meine" },
  { day: 4, code: "Z4", done_on: "2026-10-07", covered: "regular verbs Präsens (all endings, extra -e for -t/-d stems), 10 core + 5 bonus Wohnort & Studium words, \"an der Hochschule\" chunk, writing 5 sentences + rewrite 4/5, speaking 4/5, 15 cards", mistakes: "ich lernt / ich studieren; wir wohene; English spelling interference; ei/ie; defaults to das; umlauts dropped; ihr vs Ihr/Ihre; Meine Vorname → Mein; siebundvierzig; in die Hochschule → an der", carry_over: "ich → -e, compounds take last word's article, -e words = die, plurals Fächer/Prüfungen" },
  { day: 5, code: "Z5", done_on: "2026-10-10", covered: "haben, der/die/das + ein/eine, 5 plural patterns, einen after haben for der-words, 10 core + 5 bonus everyday objects, writing about own things, speaking drill", mistakes: "wir lernt → lernen; du arbeitst → arbeitest; verbs capitalised mid-sentence; plural missing after numbers; ein Stift → einen Stift; einen overgeneralised; Sie/sie formal vs she", carry_over: "einen only for der-words; wir -en; extra -e after -t stems; plural after numbers" },
  { day: 6, code: "Z6", done_on: "2026-10-12", covered: "W-questions + yes/no questions (verb first), 10 core + 5 bonus Kennenlernen words, writing 5 Sprachcafé questions + rewrite, speaking 4/5, Speaking mode (27 sentence cards)", mistakes: "ein/eine/einen reversed; verb ending not matched to subject after the verb (Woher kommt Sie, Wann lernen du); subject at the end; studirest → studierst; Spielest → spielst; lowercase first word in questions; die Gespräch, die Beruf; Geburstag, Wochnende; two verbs in one clause", carry_over: "einen (der only), question order + ending match, extra -e rule, capitals, das Gespräch / der Beruf" },
  { day: 7, code: "R1", done_on: "2026-10-14", covered: "error clinic on Day 6 mistakes, 3-second proofread habit, writing Tandem-app profile (~40 words) + rewrite, first Tandem voice session with Jonas", mistakes: "verbs/pronouns capitalised mid-sentence; noun capitals dropped (hobby); am der Hochschule → an der; ein Laptop → einen; English word in sentence; two verbs in one clause; mein vs meine", carry_over: "Week 1 test; proofread habit; an der Hochschule; einen for der-words" },
  { day: 8, code: "T1", done_on: "2026-10-15", covered: "Week 1 test 37.5/50 = 75% PASSED (Zahlen 5, Verben 8.5, Artikel 10, Fragen 6, Schreiben 8); Sprechen 5 answers + buchstabieren 10/10", mistakes: "siebundverizig; fünfzehen; twölf / zewi (zw-); Telefonummer; Gerburtstag / Gerpräch; die Wochenende → das; Sclüssel / Hochshule; sie habt → hat; du heißst → heißt; studieret; lowercase first word in questions (6×); capital after ?", carry_over: "Z7 next; recycle zw-, sch, Ge- words, er hat, du heißt, capitals" },
  { day: 9, code: "Z7", done_on: "2026-10-16", covered: "verb in position 2 (time chunk first), 10 build drills, Tage/Monate/Jahreszeiten words (am + day, im + month/season), writing \"Meine Woche\" (verb 2nd correct in all), 16 words + 10 speaking cards", mistakes: "comma after time chunk in every time-first sentence; sie (she) → -en instead of -t (3×); Jetzt Mein Bruder wohnt → Jetzt wohnt mein Bruder; zewi; vierundsiebzehn → siebenundvierzig; Gerburtstag; die Wochenende", carry_over: "no comma after time chunk; sie (she) → -t; zw-; noun capitals" },
  { day: 10, code: "Z8", done_on: "2026-10-17", covered: "telling the time (formal + informal: nach / vor / Viertel / halb), Wie spät ist es?, um vs am, Tagesablauf words via flashcards (12 words + 10 speaking), writing \"Mein Tagesablauf\" + rewrite, speaking 2/5 → redo 3/4", mistakes: "comma after time chunk in first drafts; 9:45 said as Viertel nach zehn → Viertel vor zehn; am halb acht → um; uhr / viertel lowercase; halb acht Uhr; zewi (4th time); zwanzing; meine Bruder → mein; Wochenede; Frühstück spelling; Jaden → jeden; typos", carry_over: "Viertel vor vs nach + halb (#1 item), um vs am, no comma after time chunk, Uhr/Viertel capitals, zwei, frühstücke; next Z9" },
];

export const SEED_WEAK: { text: string; repeats: number; status: "active" | "fixed" }[] = [
  { text: "Capitals: first word of EVERY sentence incl. questions; every noun (Student, Hobby, Prüfung, Uhr, Viertel); verbs/pronouns/um lowercase mid-sentence; capital again after ?; only formal Sie/Ihr/Ihre capital", repeats: 3, status: "active" },
  { text: "No comma after a time chunk (Am Montag habe ich …); two time chunks = one block (Am Samstag um sieben Uhr …)", repeats: 2, status: "active" },
  { text: "Telling the time: Viertel vor (:45 → vor + NEXT hour) vs Viertel nach (:15); halb = toward next hour; no Uhr after halb/Viertel", repeats: 1, status: "active" },
  { text: "um + clock time vs am + day / part of day", repeats: 1, status: "active" },
  { text: "sie (she) = er form → -t (sie spielt, sie studiert)", repeats: 2, status: "active" },
  { text: "Sentence frame: end mark (. / ?), no space before . / ? ,", repeats: 1, status: "active" },
  { text: "Typos when typing fast — proofread backwards word by word", repeats: 1, status: "active" },
  { text: "zw- start: zwei, zwölf, zwanzig (zewi 4×)", repeats: 4, status: "active" },
  { text: "sch spelling for the \"sh\" sound: Schlüssel, Hochschule", repeats: 1, status: "active" },
  { text: "Ge- words: no r after Ge-, t before s (Geburtstag, Gespräch)", repeats: 3, status: "active" },
  { text: "Wochenende = Wochen + Ende (das Wochenende); Telefonnummer = Telefon + Nummer", repeats: 3, status: "active" },
  { text: "Frühstück = Früh + Stück; ich frühstücke", repeats: 1, status: "active" },
  { text: "Number spelling: -zig not -zing, fünf with dots, -zehn only 13–19, 47 = siebenundvierzig (ones first)", repeats: 2, status: "active" },
  { text: "haben irregular: du hast, er/sie/es hat (habt = ihr only)", repeats: 1, status: "active" },
  { text: "du heißt (s-stems: only -t)", repeats: 1, status: "active" },
  { text: "Extra -e only after -t/-d stems (arbeitest) — not spielest/studieret", repeats: 2, status: "active" },
  { text: "One verb per clause (Mein Hobby ist Fußball / Ich spiele gern Fußball)", repeats: 2, status: "active" },
  { text: "Follow the task brief (du vs Sie, required content, start answers with the time)", repeats: 1, status: "active" },
  { text: "Umlaut lip rounding: ö = rounded \"ay\", ü = rounded \"ee\"", repeats: 1, status: "active" },
  { text: "ch: throat rasp after a/o/u/au vs soft hiss elsewhere; final b/d/g → p/t/k", repeats: 1, status: "active" },
  { text: "du vs Sie in replies (Wie geht's? → und dir? / Wie geht es Ihnen? → und Ihnen?)", repeats: 1, status: "active" },
  { text: "ei vs ie (drei, dreißig; studieren); jeden (not jaden)", repeats: 2, status: "active" },
  { text: "mein/Ihr + der/das words, meine/Ihre + die words", repeats: 2, status: "active" },
  { text: "Articles: compound = last word's article; -e/-in/-ung/-ität → die; Ge- often das; days/months/seasons der", repeats: 2, status: "active" },
  { text: "lernen (learn) vs studieren (study at university)", repeats: 1, status: "active" },
  { text: "English interference (learnt, study, Address, watching, twölf)", repeats: 2, status: "active" },
  { text: "Fixed chunks: an der Hochschule; am Wochenende; Geburtstag haben; die Anmeldung machen; Ich stehe um … auf", repeats: 2, status: "active" },
  { text: "Verb in position 2 after a time chunk", repeats: 0, status: "fixed" },
  { text: "ein / eine / einen after haben", repeats: 0, status: "fixed" },
  { text: "sind vs seid", repeats: 0, status: "fixed" },
  { text: "Question word order (W-word → verb → subject; yes/no: verb first)", repeats: 0, status: "fixed" },
  { text: "ich → -e, wir → -en, du → -st", repeats: 0, status: "fixed" },
];

export const SEED_SCORES = [
  { label: "Week 1 test (Z1–Z6)", score: 37.5, max: 50, taken_on: "2026-10-15", notes: "Zahlen 5 · Verben 8.5 · Artikel 10 · Fragen 6 · Schreiben 8" },
];

export const SEED_TANDEM = [
  { taken_on: "2026-10-14", scenario: "Kennenlernen (first test, voice)", did_well: "verb endings du/er/sie all correct, W-question order perfect", mistakes: "unsure of Wie geht es dir? / Mir geht es gut; voice recognition struggled (Wann → \"one\")", added: "Wie geht es dir? – Mir geht es gut." },
];
