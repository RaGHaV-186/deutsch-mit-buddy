import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppChrome } from "@/components/ds";
import { announceDeckChanged } from "@/lib/cards/deck-badge";
import { openStore } from "@/lib/cards/offline-store";
import { makeCard, seenCard } from "@/lib/cards/test-helpers";
import { AppChromeLive } from "./AppChromeLive";

function Probe() {
  const { initial, due } = useAppChrome();
  return <p>{`${initial}:${due}`}</p>;
}

beforeEach(() => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe("AppChromeLive", () => {
  it("shows the server's initial at once, no badge without a deck, and the device's count once a deck is stored and announced", async () => {
    render(
      <AppChromeLive initial="R" userId="u1">
        <Probe />
      </AppChromeLive>,
    );
    expect(screen.getByText("R:0")).toBeInTheDocument();

    const now = new Date();
    const store = await openStore();
    await store.replaceSnapshot("u1", { now: now.toISOString(), timezone: "Europe/Berlin", newToday: 0, cards: [seenCard(new Date(now.getTime() - 3600_000).toISOString()), makeCard()] }, now);
    store.close();
    act(() => announceDeckChanged());
    await waitFor(() => expect(screen.getByText("R:2")).toBeInTheDocument());
  });
});
