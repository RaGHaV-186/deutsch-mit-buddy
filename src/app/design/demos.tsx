"use client";

import { useState } from "react";
import { CodeInput, ErrorState, PillButton, Toast } from "@/components/ds";

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
