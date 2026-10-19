import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, createMember, resetState, uniqueEmail, type TestUser } from "./helpers";

describe("server-only tables and functions", () => {
  let a: TestUser;
  beforeAll(async () => {
    await resetState();
    a = await createMember();
  });
  afterAll(resetState);

  for (const table of ["waitlist", "app_config", "rate_limits"]) {
    it(`${table}: anon and members can neither read nor write`, async () => {
      for (const client of [anon(), a.aal2, a.aal1]) {
        const read = await client.from(table).select("*");
        expect(read.error?.code).toBe("42501");
        const write = await client.from(table).insert({});
        expect(write.error?.code).toBe("42501");
      }
    });
  }

  it("waitlist: the server (service role) can add an email once", async () => {
    const email = uniqueEmail();
    expect((await admin.from("waitlist").insert({ email })).error).toBeNull();
    const dup = await admin.from("waitlist").insert({ email: email.toUpperCase() });
    expect(dup.error?.code).toBe("23505");
  });

  it("hit_rate_limit: callable by the server only, and it limits", async () => {
    for (const client of [anon(), a.aal2]) {
      const { error } = await client.rpc("hit_rate_limit", { p_key: "x", p_limit: 5, p_window_seconds: 60 });
      expect(error?.code).toBe("42501");
    }
    const call = () => admin.rpc("hit_rate_limit", { p_key: "test:limit", p_limit: 2, p_window_seconds: 3600 });
    expect((await call()).data).toBe(true);
    expect((await call()).data).toBe(true);
    expect((await call()).data).toBe(false);
  });
});
