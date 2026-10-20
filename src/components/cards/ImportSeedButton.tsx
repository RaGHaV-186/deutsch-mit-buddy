"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { importSeedDeckAction, type ImportState } from "@/app/(app)/cards/actions";
import { FormError } from "@/components/FormParts";
import { secondaryButtonClass } from "@/components/ui";

/** Admin only: gives Raghav his seed deck. Safe to press again. */
export function ImportSeedButton({ onImported }: { onImported: () => void }) {
  const t = useTranslations("Cards.import");
  const [pending, start] = useTransition();
  const [state, setState] = useState<ImportState>();

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-foreground/20 p-4">
      <h2 className="font-heading text-lg font-bold">{t("title")}</h2>
      <p className="text-sm text-muted">{t("body")}</p>
      <button
        type="button"
        className={secondaryButtonClass}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await importSeedDeckAction();
            setState(result);
            if (result?.result) onImported();
          })
        }
      >
        {pending ? t("working") : t("button")}
      </button>
      {state?.result ? (
        <p role="status">
          {t("result", {
            imported: state.result.imported,
            seen: state.result.seen,
            fresh: state.result.fresh,
            alreadyThere: state.result.alreadyThere,
            duplicatesSkipped: state.result.duplicatesSkipped,
          })}
        </p>
      ) : null}
      <FormError code={state?.error === "forbidden" ? undefined : state?.error} />
      {state?.error === "forbidden" ? <p role="alert">{t("forbidden")}</p> : null}
    </section>
  );
}
