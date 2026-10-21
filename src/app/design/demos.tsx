"use client";

import { useMemo, useState } from "react";
import { ReviewSession } from "@/components/cards/ReviewSession";
import { SyncChip } from "@/components/cards/SyncChip";
import { CodeInput, ErrorState, PillButton, Toast } from "@/components/ds";
import { makeCard } from "@/lib/cards/test-helpers";

/** Interactive pieces of the /design page (dev tool: English only, not part of the app UI). */

export function CodeDemo() {
  const [value, setValue] = useState("");
  const [errorKey, setErrorKey] = useState(0);
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <CodeInput
        value={value}
        onChange={(v) => {
          setValue(v);
          setFailed(false);
        }}
        onComplete={(v) => {
          if (v !== "123456") {
            setFailed(true);
            setErrorKey((k) => k + 1);
          }
        }}
        error={failed}
        errorKey={errorKey}
      />
      <p className="text-caption text-muted">Type, paste or autofill a code. “123456” is right; anything else shakes once.</p>
    </div>
  );
}

export function ToastDemo() {
  const [kind, setKind] = useState<"success" | "error" | "info" | null>(null);
  return (
    <div className="flex flex-wrap gap-2">
      <PillButton variant="cushion" size={44} onClick={() => setKind("success")}>
        Success toast
      </PillButton>
      <PillButton variant="cushion" size={44} onClick={() => setKind("error")}>
        Error toast
      </PillButton>
      <PillButton variant="cushion" size={44} onClick={() => setKind("info")}>
        Info toast
      </PillButton>
      <Toast open={kind !== null} kind={kind ?? "success"} onClose={() => setKind(null)}>
        {kind === "error" ? "That didn’t work" : kind === "info" ? "Synced just now" : "Saved"}
      </Toast>
    </div>
  );
}

export function ErrorDemo() {
  const [tries, setTries] = useState(0);
  return <ErrorState message={tries ? `Still offline (try ${tries})` : "Couldn’t load your cards"} onRetry={() => setTries((n) => n + 1)} />;
}

/** The desktop flashcard review (focus mode) with a few sample cards; answers are not saved. */
export function FlashcardDemo({ game }: { game: boolean }) {
  const cards = useMemo(
    () => [
      makeCard({ kind: "word", article: "der", de: "Kaffee", en: "coffee", plural: "die Kaffees", example: "Ich trinke einen Kaffee.", exampleEn: "I drink a coffee." }),
      makeCard({ kind: "word", article: "die", de: "Milch", en: "milk", plural: null, example: "Einen Kaffee mit Milch, bitte.", exampleEn: "A coffee with milk, please." }),
      makeCard({ kind: "word", article: "das", de: "Wasser", en: "water", plural: null, example: "Ich möchte Wasser.", exampleEn: "I would like water." }),
      makeCard({ kind: "say", article: null, en: "My name is Raghav.", de: "Ich heiße Raghav.", plural: null, example: null, exampleEn: null }),
    ],
    [],
  );
  return (
    <ReviewSession
      cards={cards}
      direction="en-de"
      gameLayer={game}
      onAnswer={async (card) => card}
      onFinish={() => {}}
      onOptions={() => {}}
      status={<SyncChip pill sync="synced" pending={0} onRetry={() => {}} />}
    />
  );
}
