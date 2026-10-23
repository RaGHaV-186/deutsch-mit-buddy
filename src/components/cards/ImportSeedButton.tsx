"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { importSeedDeckAction, type ImportState } from "@/app/(app)/cards/actions";
import { FormError } from "@/components/FormParts";
import { Cushion, PillButton } from "@/components/ds";

/** Admin only: gives Raghav his seed deck. Safe to press again. */
export function ImportSeedButton({ onImported }: { onImported: () => void }) {
  const t = useTranslations("Cards.import");
  const [pending, start] = useTransition();
  const [state, setState] = useState<ImportState>();

  return (
    <Cushion radius={28} className="flex flex-col gap-3 p-5">
      <h2 className="text-headline">{t("title")}</h2>
      <p className="text-caption text-muted">{t("body")}</p>
      <PillButton
        variant="cushion"
        fullWidth
        loading={pending}
        className="shadow-none ring-1 ring-track"
        onClick={() =>
          start(async () => {
            const result = await importSeedDeckAction();
            setState(result);
            if (result?.result) onImported();
          })
        }
      >
        {t("button")}
      </PillButton>
      {state?.result ? (
        <p role="status" className="text-caption">
          {t("result", {
            imported: state.result.imported,
            seen: state.result.seen,
            fresh: state.result.fresh,
            alreadyThere: state.result.alreadyThere,
            duplicatesSkipped: state.result.duplicatesSkipped,
            lessonCards: state.result.lessonCardsUnlocked,
            pointer: state.result.pointerMoved ? t("pointerMoved") : "",
          })}
        </p>
      ) : null}
      <FormError code={state?.error === "forbidden" ? undefined : state?.error} />
      {state?.error === "forbidden" ? <p role="alert">{t("forbidden")}</p> : null}
    </Cushion>
  );
}
