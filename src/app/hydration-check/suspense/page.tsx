import { Suspense } from "react";
import { Probe } from "../Probe";

async function Slow() {
  await new Promise((r) => setTimeout(r, 400));
  return <Probe page="suspense" />;
}

export default function Page() {
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 24, display: "grid", gap: 16, fontSize: 18 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>B: Suspense</h1>
      <Suspense fallback={<p>Loading (this text is the Suspense fallback)…</p>}>
        <Slow />
      </Suspense>
    </main>
  );
}
