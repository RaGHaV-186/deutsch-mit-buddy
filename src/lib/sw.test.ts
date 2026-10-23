import { readFileSync } from "node:fs";
import vm from "node:vm";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// Runs public/sw.js in a sandbox with a fake Cache Storage and fetch, and fires the events the browser would.
const source = readFileSync("public/sw.js", "utf8");
const ORIGIN = "https://buddy.test";
// Cache names carry the worker's VERSION; read it so bumping the version does not break these tests.
const VERSION = /const VERSION = "([^"]+)"/.exec(source)![1];
const SHELL = `buddy-shell-${VERSION}`;
const STATIC = `buddy-static-${VERSION}`;

class FakeCache {
  entries = new Map<string, Response>();
  private key = (r: Request | string) => new URL(typeof r === "string" ? r : r.url, ORIGIN).pathname + new URL(typeof r === "string" ? r : r.url, ORIGIN).search;
  async match(r: Request | string) {
    return this.entries.get(this.key(r))?.clone();
  }
  async put(r: Request | string, res: Response) {
    this.entries.set(this.key(r), res);
  }
  async delete(r: Request | string) {
    return this.entries.delete(this.key(r));
  }
  async keys() {
    return [...this.entries.keys()].map((k) => new Request(ORIGIN + k));
  }
}

function setup(fetchImpl: (req: Request | string, init?: RequestInit) => Promise<Response>) {
  const stores = new Map<string, FakeCache>();
  const handlers: Record<string, (e: unknown) => void> = {};
  const caches = {
    open: async (n: string) => {
      if (!stores.has(n)) stores.set(n, new FakeCache());
      return stores.get(n)!;
    },
    keys: async () => [...stores.keys()],
    delete: async (n: string) => stores.delete(n),
  };
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: (e: unknown) => void) => (handlers[type] = fn),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
  };
  vm.runInNewContext(source, { self, caches, fetch: fetchImpl, Response, Request, URL, Promise, setTimeout, clearTimeout, AbortController, console });

  const fetchEvent = (request: Request) => {
    let promise: Promise<Response> | undefined;
    handlers.fetch({ request, respondWith: (p: Promise<Response>) => (promise = p), waitUntil: (p: Promise<unknown>) => void p.catch(() => {}) });
    return promise; // undefined = the worker left the request to the network
  };
  const waitFor = async (type: string, event: Record<string, unknown>) => {
    let p: Promise<unknown> | undefined;
    handlers[type]({ ...event, waitUntil: (x: Promise<unknown>) => (p = x) });
    await p;
  };
  return { stores, handlers, self, fetchEvent, waitFor };
}

const nav = (path: string) => {
  const r = new Request(ORIGIN + path);
  Object.defineProperty(r, "mode", { value: "navigate" });
  return r;
};
const html = (body: string, init: ResponseInit = {}) => new Response(body, { status: 200, ...init });
const basic = (res: Response) => {
  Object.defineProperty(res, "type", { value: "basic" });
  return res;
};

describe("service worker", () => {
  let online = true;
  let network: Mock<(req: Request | string, init?: RequestInit) => Promise<Response>>;
  beforeEach(() => {
    online = true;
    network = vi.fn(async (req: Request | string) => {
      if (!online) throw new TypeError("Failed to fetch");
      const path = new URL(typeof req === "string" ? req : req.url, ORIGIN).pathname;
      if (path === "/offline") return basic(html('<script src="/_next/static/chunks/shell-abc.js"></script> <link href="/_next/static/css/shell.css">'));
      if (path === "/cards") return basic(html("Anna's cards, 12 due"));
      if (path === "/home") return basic(html("Hallo, Anna! home page"));
      return basic(html("file:" + path));
    });
  });

  it("leaves the API, login, other pages, data requests and non-GET requests to the network", () => {
    const sw = setup(network);
    for (const path of ["/api/cards/sync", "/login", "/mfa", "/", "/cards?_rsc=1abc"]) {
      expect(sw.fetchEvent(new Request(ORIGIN + path))).toBeUndefined();
    }
    expect(sw.fetchEvent(nav("/login"))).toBeUndefined();
    expect(sw.fetchEvent(nav("/auth/callback"))).toBeUndefined();
    expect(sw.fetchEvent(new Request(ORIGIN + "/cards", { method: "POST", body: "x" }))).toBeUndefined();
    expect(sw.fetchEvent(new Request("https://other.example/_next/static/x.js"))).toBeUndefined();
  });

  it("static files: fetched once, then served from the cache even offline", async () => {
    const sw = setup(network);
    const first = await sw.fetchEvent(new Request(ORIGIN + "/_next/static/chunks/a.js"));
    expect(await first!.text()).toBe("file:/_next/static/chunks/a.js");
    online = false;
    const again = await sw.fetchEvent(new Request(ORIGIN + "/_next/static/chunks/a.js"));
    expect(await again!.text()).toBe("file:/_next/static/chunks/a.js");
    expect(network).toHaveBeenCalledTimes(1);
  });

  it("an app screen comes from the network every time and is never saved (it holds the learner's data)", async () => {
    const sw = setup(network);
    for (const path of ["/home", "/cards", "/learn", "/learn/Z4", "/me", "/play"]) {
      const res = await sw.fetchEvent(nav(path));
      expect(res!.status).toBe(200);
    }
    expect(await (await sw.fetchEvent(nav("/home")))!.text()).toContain("Hallo, Anna");
    expect(network).toHaveBeenCalledTimes(7);
    const everything = [...sw.stores.values()].flatMap((c) => [...c.entries.keys()]);
    expect(everything).toEqual([]);
  });

  it("an app screen that cannot be reached sends the browser to the offline shell, not to a saved copy", async () => {
    const sw = setup(network);
    await sw.fetchEvent(nav("/cards")); // online once: nothing is kept
    online = false;
    const res = await sw.fetchEvent(nav("/cards"));
    expect(res!.status).toBe(302);
    expect(new URL(res!.headers.get("location")!).pathname).toBe("/offline");
    expect(await caches_(sw, SHELL).then((c) => c.entries.size)).toBe(0);
  });

  it("an app screen that hangs on a bad connection is treated as unreachable after the timeout", async () => {
    vi.useFakeTimers();
    try {
      const sw = setup((req, init) => new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new TypeError("aborted")))));
      const pending = sw.fetchEvent(nav("/home"))!;
      await vi.advanceTimersByTimeAsync(6100);
      expect((await pending).status).toBe(302);
    } finally {
      vi.useRealTimers();
    }
  });

  it("the offline shell: fetched once, then served from the phone (even offline) and refreshed in the background", async () => {
    const sw = setup(network);
    const first = await sw.fetchEvent(nav("/offline"));
    expect(await first!.text()).toContain("shell-abc.js");
    online = false;
    const offline = await sw.fetchEvent(nav("/offline"));
    expect(offline!.status).toBe(200);
    expect(await offline!.text()).toContain("shell-abc.js");
  });

  it("the shell is the only page ever saved, and never a redirect or an error", async () => {
    const redirected = basic(html("login page"));
    Object.defineProperty(redirected, "redirected", { value: true });
    const failing = basic(new Response("boom", { status: 500 }));
    let next: Response = redirected;
    const sw = setup(async () => next);
    await sw.fetchEvent(nav("/offline"))?.catch(() => {});
    next = failing;
    await sw.fetchEvent(nav("/offline"))?.catch(() => {});
    expect([...(await caches_(sw, SHELL)).entries.keys()]).toEqual([]);
  });

  it("offline with no shell saved yet: a short notice instead of the browser error page", async () => {
    online = false;
    const sw = setup(network);
    const res = await sw.fetchEvent(nav("/offline"));
    expect(res!.status).toBe(503);
    expect(await res!.text()).toContain("offline");
  });

  it("warm: saves the shell and every file it references, plus static files the page reports, and nothing else", async () => {
    const sw = setup(network);
    await sw.waitFor("message", {
      data: { type: "warm", assets: [ORIGIN + "/_next/static/chunks/loaded.js", ORIGIN + "/buddy/buddy-happy.svg", ORIGIN + "/cards", "https://other.example/_next/static/x.js"] },
    });
    expect([...(await caches_(sw, SHELL)).entries.keys()]).toEqual(["/offline"]);
    expect([...(await caches_(sw, STATIC)).entries.keys()].sort()).toEqual([
      "/_next/static/chunks/loaded.js",
      "/_next/static/chunks/shell-abc.js",
      "/_next/static/css/shell.css",
      "/buddy/buddy-happy.svg",
    ]);
  });

  it("warm while offline keeps what it has and does not throw", async () => {
    online = false;
    const sw = setup(network);
    await expect(sw.waitFor("message", { data: { type: "warm", assets: [] } })).resolves.toBeUndefined();
  });

  it("a new version deletes every older cache of ours, including the one that used to hold app screens, and nobody else's", async () => {
    const sw = setup(network);
    sw.stores.set("buddy-pages-v2", new FakeCache()); // v2 saved the HTML of /home and /cards
    sw.stores.set("buddy-static-v2", new FakeCache());
    sw.stores.set("somebody-elses", new FakeCache());
    await sw.waitFor("activate", {});
    expect([...sw.stores.keys()]).toEqual(["somebody-elses"]);
    expect(sw.self.clients.claim).toHaveBeenCalled();
  });

  it("takes over immediately on install", () => {
    const sw = setup(network);
    sw.handlers.install({});
    expect(sw.self.skipWaiting).toHaveBeenCalled();
  });
});

async function caches_(sw: ReturnType<typeof setup>, name: string) {
  if (!sw.stores.has(name)) sw.stores.set(name, new FakeCache());
  return sw.stores.get(name)!;
}
