import { afterEach, describe, expect, it, vi } from "vitest";
import setup from "../../../tests/rls/global-setup";
import { assertLocalSupabase, isLocalUrl } from "./local-only";

describe("isLocalUrl", () => {
  it.each(["http://127.0.0.1:54321", "http://localhost:54321", "https://localhost", "http://[::1]:54321", "postgresql://postgres:postgres@127.0.0.1:54322/postgres"])("%s is local", (url) => {
    expect(isLocalUrl(url)).toBe(true);
  });

  it.each([
    "https://jzmuvdqrmilayoekykqd.supabase.co",
    "http://localhost.example.com",
    "http://127.0.0.1.nip.io",
    "http://localhost@evil.example.com",
    "http://evil.example.com/localhost",
    "http://127.0.0.2:54321",
    "http://0.0.0.0:54321",
    "not a url",
    "",
    undefined,
  ])("%s is not local", (url) => {
    expect(isLocalUrl(url)).toBe(false);
  });
});

describe("assertLocalSupabase", () => {
  it("passes for the local stack, with or without a database URL", () => {
    expect(() => assertLocalSupabase({ SUPABASE_URL: "http://127.0.0.1:54321" })).not.toThrow();
    expect(() => assertLocalSupabase({ SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres" })).not.toThrow();
  });

  it("refuses a hosted API, a hosted database, and 'not set'", () => {
    expect(() => assertLocalSupabase({ SUPABASE_URL: "https://abc.supabase.co" })).toThrow(/Refusing to run/);
    expect(() => assertLocalSupabase({ SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_DB_URL: "postgresql://postgres:pw@db.abc.supabase.co:5432/postgres" })).toThrow(/SUPABASE_DB_URL/);
    expect(() => assertLocalSupabase({})).toThrow(/not set/);
  });
});

describe("the database tests' global setup", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    vi.unstubAllGlobals();
  });

  it("stops before it reads or writes anything when the URL is hosted", async () => {
    process.env.SUPABASE_URL = "https://abc.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(setup()).rejects.toThrow(/Refusing to run/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("stops when the database URL is hosted even if the API URL is local", async () => {
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    process.env.SUPABASE_DB_URL = "postgresql://postgres:pw@db.abc.supabase.co:5432/postgres";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(setup()).rejects.toThrow(/SUPABASE_DB_URL/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
