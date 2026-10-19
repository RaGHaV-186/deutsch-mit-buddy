import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, createMember, resetState, type TestUser } from "./helpers";

describe("profiles: one user cannot touch another's profile", () => {
  let a: TestUser;
  let b: TestUser;

  beforeAll(async () => {
    await resetState();
    a = await createMember();
    b = await createMember();
  });
  afterAll(resetState);

  it("creates a member profile on sign-up", async () => {
    const { data } = await admin.from("profiles").select("*").eq("user_id", a.id).single();
    expect(data?.role).toBe("member");
    expect(data?.onboarded_at).toBeNull();
  });

  it("lets A read their own profile", async () => {
    const { data, error } = await a.aal2.from("profiles").select("user_id").eq("user_id", a.id);
    expect(error).toBeNull();
    expect(data).toEqual([{ user_id: a.id }]);
  });

  it("returns only A's row when A selects everything", async () => {
    const { data } = await a.aal2.from("profiles").select("user_id");
    expect(data).toEqual([{ user_id: a.id }]);
  });

  it("hides B's profile from A when asked by id", async () => {
    const { data, error } = await a.aal2.from("profiles").select("*").eq("user_id", b.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("does not let A update B's profile", async () => {
    const { data } = await a.aal2.from("profiles").update({ display_name: "hacked" }).eq("user_id", b.id).select();
    expect(data).toEqual([]);
    const { data: row } = await admin.from("profiles").select("display_name").eq("user_id", b.id).single();
    expect(row?.display_name).not.toBe("hacked");
  });

  it("lets A edit their own cosmetic fields", async () => {
    const { data, error } = await a.aal2.from("profiles").update({ display_name: "Anna" }).eq("user_id", a.id).select();
    expect(error).toBeNull();
    expect(data?.[0]?.display_name).toBe("Anna");
  });

  it("stops A from making themselves admin", async () => {
    const { error } = await a.aal2.from("profiles").update({ role: "admin" }).eq("user_id", a.id);
    expect(error?.code).toBe("42501");
    const { data } = await admin.from("profiles").select("role").eq("user_id", a.id).single();
    expect(data?.role).toBe("member");
  });

  it("stops A from moving their own lesson pointer or day counter", async () => {
    for (const patch of [{ session_seq: 99 }, { day_count: 99 }, { onboarded_at: new Date().toISOString() }]) {
      const { error } = await a.aal2.from("profiles").update(patch).eq("user_id", a.id);
      expect(error?.code).toBe("42501");
    }
  });

  it("allows no inserts and no deletes", async () => {
    const ins = await a.aal2.from("profiles").insert({ user_id: a.id });
    expect(ins.error?.code).toBe("42501");
    const del = await a.aal2.from("profiles").delete().eq("user_id", a.id);
    expect(del.error?.code).toBe("42501");
    const { data } = await admin.from("profiles").select("user_id").eq("user_id", a.id);
    expect(data).toHaveLength(1);
  });

  it("shows nothing to a password-only (AAL1) session, even for the owner", async () => {
    const read = await a.aal1.from("profiles").select("*");
    expect(read.error).toBeNull();
    expect(read.data).toEqual([]);
    const write = await a.aal1.from("profiles").update({ display_name: "aal1" }).eq("user_id", a.id).select();
    expect(write.data).toEqual([]);
  });

  it("denies the anonymous role", async () => {
    const { error } = await anon().from("profiles").select("*");
    expect(error?.code).toBe("42501");
  });
});
