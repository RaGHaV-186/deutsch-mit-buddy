"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { CardsApp } from "@/components/cards/CardsApp";
import { openStore } from "@/lib/cards/offline-store";

type Deck = { status: "loading" } | { status: "none" } | { status: "deck"; userId: string };

/** The Cards screen without the server: the deck on this device belongs to whoever last synced here, and that is who gets it. */
export function OfflineApp({ gameLayer }: { gameLayer: boolean }) {
  const t = useTranslations("Offline");
  const [deck, setDeck] = useState<Deck>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const store = await openStore();
        const userId = await store.currentUserId();
        store.close();
        if (alive) setDeck(userId ? { status: "deck", userId } : { status: "none" });
      } catch {
        if (alive) setDeck({ status: "none" });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (deck.status === "deck") {
    return (
      <>
        <p role="status" className="bg-surface px-5 py-2 text-center text-caption text-muted">
          {t("banner")} <a href="/home" className="font-bold text-text underline underline-offset-2">{t("openApp")}</a>
        </p>
        <CardsApp userId={deck.userId} isAdmin={false} gameLayer={gameLayer} />
      </>
    );
  }
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center gap-4 px-5 text-center">
      <p>{deck.status === "loading" ? t("loading") : t("noDeck")}</p>
      {deck.status === "none" ? (
        <a href="/home" className="font-bold underline underline-offset-2">
          {t("openApp")}
        </a>
      ) : null}
    </main>
  );
}
