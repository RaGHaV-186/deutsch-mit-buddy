import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { admin, anon, createUserRaw, resetState, seatsUsed, setMemberCap, sql, uniqueEmail } from "./helpers";

/** Profiles of the users this file created (the dev account's profile is not ours to count). */
const testProfiles = async () => {
  const { data } = await admin.from("profiles").select("user_id");
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
  const ours = new Set((users?.users ?? []).filter((u) => /^rls-.+@example\.test$/.test(u.email ?? "")).map((u) => u.id));
  return (data ?? []).filter((p) => ours.has(p.user_id)).length;
};

const open = async () => (await anon().rpc("signup_open")).data;

describe("member cap and waitlist", () => {
  beforeEach(async () => {
    await resetState();
    // Room for exactly 3 of our users on top of any real member account already in the database.
    await setMemberCap((await seatsUsed()) + 3);
  });
  afterAll(resetState);

  it("accepts sign-ups up to the cap and rejects the next one", async () => {
    expect(await open()).toBe(true);
    for (let i = 0; i < 3; i++) expect((await createUserRaw()).error).toBeNull();
    expect(await open()).toBe(false);
    const extra = await createUserRaw();
    expect(extra.error).not.toBeNull();
    expect(await testProfiles()).toBe(3);
  });

  it("never overshoots the cap under concurrent sign-ups", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => createUserRaw()));
    expect(results.filter((r) => !r.error)).toHaveLength(3);
    expect(await testProfiles()).toBe(3);
  });

  it("lets an approved waitlist email in when full, but not an unapproved one", async () => {
    for (let i = 0; i < 3; i++) await createUserRaw();
    const approved = uniqueEmail();
    const pending = uniqueEmail();
    expect((await admin.from("waitlist").insert([{ email: approved, approved: true }, { email: pending, approved: false }])).error).toBeNull();
    expect((await createUserRaw(pending)).error).not.toBeNull();
    expect((await createUserRaw(approved)).error).toBeNull();
  });

  it("does not count admins against the cap", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push((await createUserRaw()).data.user!.id);
    expect(await open()).toBe(false);
    await admin.from("profiles").update({ role: "admin" }).eq("user_id", ids[0]);
    expect(await open()).toBe(true);
  });

  it("frees seats held by sign-ups that never confirmed their email", async () => {
    const { data } = await createUserRaw(uniqueEmail(), false);
    await createUserRaw();
    await createUserRaw();
    expect(await open()).toBe(false);
    await sql("update auth.users set created_at = now() - interval '3 hours' where id = $1", [data.user!.id]);
    expect(await open()).toBe(true);
  });
});
