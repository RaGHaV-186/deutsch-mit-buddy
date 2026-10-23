import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openStore } from "@/lib/cards/offline-store";
import { makeCard, seenCard } from "@/lib/cards/test-helpers";
import { renderWithIntl } from "@/test-utils";

vi.mock("next/navigation", () => ({ usePathname: () => "/offline", useRouter: () => ({ refresh() {}, prefetch() {} }) }));

import { OfflineApp } from "./OfflineApp";

beforeEach(() => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
});

describe("OfflineApp (the offline shell)", () => {
  it("without a deck on this device it explains and offers the way back", async () => {
    renderWithIntl(<OfflineApp gameLayer={false} />);
    expect(await screen.findByText(/Open Deutsch mit Buddy once with a connection/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the app" })).toHaveAttribute("href", "/home");
  });

  it("with a deck it opens the Cards from this device, for the account that synced here, with an offline banner", async () => {
    const now = new Date();
    const store = await openStore();
    await store.replaceSnapshot("u1", { now: now.toISOString(), timezone: "Europe/Berlin", newToday: 0, cards: [seenCard(new Date(now.getTime() - 3600_000).toISOString()), makeCard()] }, now);
    store.close();
    renderWithIntl(<OfflineApp gameLayer={false} />);
    expect(await screen.findByText(/You're offline\. Your cards still work/)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Start review/ })).toBeEnabled();
  });
});
