"use client";

import { useTranslations } from "next-intl";
import { useState, type ComponentProps } from "react";
import { EyeIcon, EyeOffIcon } from "./icons";
import { TextField } from "./TextField";

/** Password input with a show/hide button. */
export function PasswordField(props: Omit<ComponentProps<typeof TextField>, "type" | "trailing">) {
  const t = useTranslations("Ds");
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          aria-pressed={visible}
          className="ds-press ds-focus flex h-11 w-11 items-center justify-center rounded-full text-muted"
        >
          {visible ? <EyeOffIcon size={22} /> : <EyeIcon size={22} />}
        </button>
      }
    />
  );
}
