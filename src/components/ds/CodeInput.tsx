"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { cx } from "./cx";

interface Props {
  length?: number;
  /** Controlled value (digits only). Leave out to let the component keep it. */
  value?: string;
  onChange?: (value: string) => void;
  /** Called once, when the last digit is filled. */
  onComplete?: (value: string) => void;
  /** Red borders. Change `errorKey` to replay the shake. */
  error?: boolean;
  errorKey?: number;
  /** Adds a hidden input with this name holding the joined code, so the component works inside a <form>. */
  name?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

const digitsOnly = (s: string) => s.replace(/\D/g, "");

/** Six boxes for a one-time code: auto-advance, backspace goes back, paste and iOS/Android autofill fill them all. */
export function CodeInput({ length = 6, value, onChange, onComplete, error = false, errorKey = 0, name, disabled, autoFocus }: Props) {
  const t = useTranslations("Ds");
  const [inner, setInner] = useState("");
  const code = (value ?? inner).slice(0, length);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function commit(next: string) {
    const clean = next.slice(0, length);
    if (value === undefined) setInner(clean);
    onChange?.(clean);
    if (clean.length === length && next !== code) onComplete?.(clean);
  }

  /** Writes `digits` into the code starting at box `from` (replacing what is there) and focuses the box after the last one. */
  function place(from: number, digits: string) {
    const start = Math.min(from, code.length);
    const next = (code.slice(0, start) + digits + code.slice(start + digits.length)).slice(0, length);
    commit(next);
    refs.current[Math.min(start + digits.length, length - 1)]?.focus();
  }

  function onInput(i: number, raw: string) {
    const digits = digitsOnly(raw);
    if (digits === "") {
      const chars = code.split("");
      chars.splice(i, 1);
      commit(chars.join(""));
      return;
    }
    // An autofill or a multi-digit entry lands in one box: spread it from the first box.
    place(digits.length > 1 && digits.length >= length ? 0 : i, digits);
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !code[i] && i > 0) {
      e.preventDefault();
      commit(code.slice(0, i - 1) + code.slice(i));
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < length - 1) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
  }

  function onPaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    const digits = digitsOnly(e.clipboardData.getData("text"));
    if (!digits) return;
    e.preventDefault();
    place(digits.length >= length ? 0 : i, digits);
  }

  return (
    <div role="group" aria-label={t("codeGroup")} className={cx("flex justify-center gap-2", error && "ds-shake")} key={errorKey}>
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={code[i] ?? ""}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => onPaste(i, e)}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          aria-label={t("codeDigit", { n: i + 1, total: length })}
          aria-invalid={error || undefined}
          maxLength={i === 0 ? length : 1}
          className={cx(
            "ds-focus h-14 w-12 rounded-[14px] bg-surface text-center text-[24px] font-extrabold text-text tabular shadow-cushion",
            "focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60",
            error && "ring-2 ring-die",
          )}
        />
      ))}
      {name ? <input type="hidden" name={name} value={code} /> : null}
    </div>
  );
}
