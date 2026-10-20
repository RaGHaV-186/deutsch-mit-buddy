import { readFileSync } from "node:fs";
import vm from "node:vm";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// Runs public/sw.js in a sandbox with a fake Cache Storage and fetch, and fires the events the browser would.
const source = readFileSync("public/sw.js", "utf8");
const ORIGIN = "https://buddy.test";

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
  vm.runInNewContext(source, { self, caches, fetch: fetchImpl, Response, Request, URL, Promise, setTimeout, console });

  const fetchEvent = (request: Request) => {
    let promise: Promise<Response> | undefined;
    handlers.fetch({ request, respondWith: (p: Promise<Response>) => (promise = p) });
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
      if (path === "/cards") return basic(html('<script src="/_next/static/chunks/cards-abc.js"></script>'));
      if (path === "/home") return basic(html("home page /_next/static/css/app.css"));
      return basic(html("file:" + path));
    });
  });

  it("leaves the API, login, other pages and non-GET requests to the network", () => {
    const sw = setup(network);
    for (const path of ["/api/cards/sync", "/login", "/mfa", "/", "/cards?_rsc=1abc"]) {
      expect(sw.fetchEvent(new Request(ORIGIN + path))).toBeUndefined();
    }
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

  it("an app page: fresh from the network, saved, and served from the save when offline", async () => {
    const sw = setup(network);
    const live = await sw.fetchEvent(nav("/cards"));
    expect(await live!.text()).toContain("cards-abc.js");
    online = false;
    const offline = await sw.fetchEvent(nav("/cards"));
    expect(offline!.status).toBe(200);
    expect(await offline!.text()).toContain("cards-abc.js");
  });

  it("offline with nothing saved: a short notice instead of the browser error page", async () => {
    online = false;
    const sw = setup(network);
    const res = await sw.fetchEvent(nav("/cards"));
    expect(res!.status).toBe(503);
    expect(await res!.text()).toContain("offline");
  });

  it("never saves a redirect (e.g. to the login page) or an error", async () => {
    const redirected = basic(html("login page"));
    Object.defineProperty(redirected, "redirected", { value: true });
    const failing = basic(new Response("boom", { status: 500 }));
    let next: Response = redirected;
    const sw = setup(async () => next);
    await sw.fetchEvent(nav("/cards"));
    next = failing;
    await sw.fetchEvent(nav("/home"));
    expect([...(await caches_(sw, "buddy-pages-v1")).entries.keys()]).toEqual([]);
  });

  it("a slow network falls back to the saved page", async () => {
    vi.useFakeTimers();
    try {
      const sw = setup(network);
      await sw.fetchEvent(nav("/home")); // saved
      network.mockImplementation(() => new Promise(() => {})); // hangs: a bad connection
      const pending = sw.fetchEvent(nav("/home"))!;
      await vi.advanceTimersByTimeAsync(4100);
      expect(await (await pending).text()).toContain("home page");
    } finally {
      vi.useRealTimers();
    }
  });

  it("warm: saves the app pages and every file they reference, plus files the page reports", async () => {
    const sw = setup(network);
    await sw.waitFor("message", {
      data: { type: "warm", pages: ["/home", "/cards", "/api/secret"], assets: [`${ORIGIN}/_next/static/media/font.woff2`, "https://evil.test/_next/static/x.js", `${ORIGIN}/login`] },
    });
    const pages = await caches_(sw, "buddy-pages-v1");
    expect([...pages.entries.keys()].sort()).toEqual(["/cards", "/home"]); // not /api/secret
    const files = [...(await caches_(sw, "buddy-static-v1")).entries.keys()].sort();
    expect(files).toEqual(["/_next/static/chunks/cards-abc.js", "/_next/static/css/app.css", "/_next/static/media/font.woff2"]);
  });

  it("warm while offline keeps what it has and does not throw", async () => {
    const sw = setup(network);
    await sw.waitFor("message", { data: { type: "warm", pages: ["/cards"], assets: [] } });
    online = false;
    await expect(sw.waitFor("message", { data: { type: "warm", pages: ["/cards"], assets: [] } })).resolves.toBeUndefined();
    expect((await caches_(sw, "buddy-pages-v1")).entries.has("/cards")).toBe(true);
  });

  it("activation removes caches from older versions, and only ours", async () => {
    const sw = setup(network);
    sw.stores.set("buddy-static-v0", new FakeCache());
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
