"use client";

import { useRef, type FormEvent, type ReactNode } from "react";
import { signOutAction } from "@/app/(auth)/actions";
import { clearOfflineData } from "@/lib/cards/local-data";

/** Sign-out that first removes the saved pages and cards from this device (unless reviews are still waiting to sync). */
export function SignOutForm({ children }: { children: ReactNode }) {
  const cleared = useRef(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (cleared.current) return;
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await clearOfflineData();
    } finally {
      cleared.current = true;
      form.requestSubmit();
    }
  }

  return (
    <form action={signOutAction} onSubmit={onSubmit}>
      {children}
    </form>
  );
}
