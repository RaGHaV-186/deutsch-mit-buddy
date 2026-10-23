import type { Metadata } from "next";
import { OfflineApp } from "@/components/OfflineApp";
import { isGameLayerOn } from "@/lib/game-layer";

export const metadata: Metadata = { robots: { index: false } };

// The offline shell: public, with nothing about any account in it. The service worker keeps this page and sends the browser here when an app
// screen cannot be reached. Everything personal comes from this device's storage, on the client.
export default function OfflinePage() {
  return <OfflineApp gameLayer={isGameLayerOn()} />;
}
