"use client";

import { useTranslations } from "next-intl";
import { BottomSheet, PillButton, SegmentedControl } from "@/components/ds";
import { DIRECTIONS, MODES, type Direction, type Mode } from "@/lib/cards/queue";

interface Props {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  direction: Direction;
  onMode: (m: Mode) => void;
  onDirection: (d: Direction) => void;
  /** During a session, changing the mode starts a fresh queue; say so. */
  inSession?: boolean;
}

/** What to practise (Words / Speaking / Both) and which way round (English → German or German → English). */
export function CardOptions({ open, onClose, mode, direction, onMode, onDirection, inSession = false }: Props) {
  const t = useTranslations("Cards");
  return (
    <BottomSheet open={open} onClose={onClose} title={t("options.title")}>
      <SegmentedControl label={t("mode.label")} value={mode} options={MODES} onChange={onMode} text={(m) => t(`mode.${m}`)} />
      {inSession ? <p className="-mt-2 text-caption text-muted">{t("options.modeNote")}</p> : null}
      <SegmentedControl
        label={t("direction.label")}
        value={direction}
        options={DIRECTIONS}
        onChange={onDirection}
        text={(d) => t(d === "en-de" ? "direction.enDe" : "direction.deEn")}
      />
      <PillButton variant="coat" fullWidth onClick={onClose}>
        {t("options.done")}
      </PillButton>
    </BottomSheet>
  );
}
