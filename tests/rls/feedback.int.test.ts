import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, createMember, resetState, type TestUser } from "./helpers";

describe("feedback", () => {
  let a: TestUser;
  let b: TestUser;
  beforeAll(async () => {
    await resetState();
    a = await createMember();
    b = await createMember();
  });
  afterAll(resetState);

  it("lets a member send feedback as themselves", async () => {
    const { error } = await a.aal2.from("feedback").insert({ user_id: a.id, message: "Wuff, great app" });
    expect(error).toBeNull();
  });

  it("refuses feedback written in someone else's name", async () => {
    const { error } = await a.aal2.from("feedback").insert({ user_id: b.id, message: "spoofed" });
    expect(error?.code).toBe("42501");
  });

  it("shows each member only their own feedback", async () => {
    await b.aal2.from("feedback").insert({ user_id: b.id, message: "B's note" });
    const { data } = await a.aal2.from("feedback").select("message");
    expect(data).toEqual([{ message: "Wuff, great app" }]);
  });

  it("refuses empty and oversized messages", async () => {
    for (const message of ["", "x".repeat(2001)]) {
      const { error } = await a.aal2.from("feedback").insert({ user_id: a.id, message });
      expect(error?.code).toBe("23514");
    }
  });

  it("blocks AAL1 sessions and anon", async () => {
    const w = await a.aal1.from("feedback").insert({ user_id: a.id, message: "no 2fa" });
    expect(w.error?.code).toBe("42501");
    const r = await a.aal1.from("feedback").select("*");
    expect(r.data).toEqual([]);
    expect((await anon().from("feedback").select("*")).error?.code).toBe("42501");
    const { count } = await admin.from("feedback").select("*", { count: "exact", head: true }).in("user_id", [a.id, b.id]);
    expect(count).toBe(2);
  });
});
