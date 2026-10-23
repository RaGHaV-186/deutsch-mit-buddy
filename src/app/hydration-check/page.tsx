import Link from "next/link";

// TEMPORARY test pages for Raghav's iPhone (perf slice): does a streamed Suspense boundary hydrate on iOS Safari with this app's stack?
// Not linked from the app. Delete this folder when the question is answered.
export default function Page() {
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 24, display: "grid", gap: 16, fontSize: 18 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Hydration check</h1>
      <p>Open each page, wait 2 seconds, tap the button. Then reload the page 10 times (pull down, or the reload button) and tap again each time.</p>
      <Link href="/hydration-check/loading-file">A: with a loading.tsx file</Link>
      <Link href="/hydration-check/suspense">B: with a hand-written Suspense</Link>
    </main>
  );
}
