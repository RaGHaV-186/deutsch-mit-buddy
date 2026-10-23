import { Probe } from "../Probe";

export default async function Page() {
  await new Promise((r) => setTimeout(r, 400));
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 24, display: "grid", gap: 16, fontSize: 18 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>A: loading.tsx</h1>
      <Probe page="loading-file" />
    </main>
  );
}
