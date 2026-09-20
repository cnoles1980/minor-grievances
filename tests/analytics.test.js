import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const key = "bureau-analytics-G-2T6MFY7V8D";
function fixture({
  policy = true,
  gpc = false,
  fetcher,
  storage = new Map(),
} = {}) {
  const scripts = [];
  const context = vm.createContext({
    window: {},
    navigator: { globalPrivacyControl: gpc },
    AbortSignal,
    location: {
      hostname: "cnoles1980.github.io",
      origin: "https://cnoles1980.github.io",
      pathname: "/minor-grievances/private-missing-path",
      search: "?q=private-text",
      hash: "#private-id",
    },
    fetch:
      fetcher ||
      (async () => ({
        ok: true,
        json: async () => ({ requiresConsent: policy }),
      })),
    localStorage: {
      getItem: (k) => storage.get(k),
      setItem: (k, v) => storage.set(k, v),
      removeItem: (k) => storage.delete(k),
    },
    document: {
      cookie: "",
      createElement: () => ({}),
      head: { appendChild: (n) => scripts.push(n) },
    },
  });
  const source = readFileSync(
    new URL("../src/analytics.js", import.meta.url),
    "utf8",
  )
    .replaceAll("import.meta.env.VITE_GA4_ID", '"G-2T6MFY7V8D"')
    .replaceAll("import.meta.env.VITE_API_URL", '"https://api.example.com"')
    .replaceAll("import.meta.env.BASE_URL", '"/minor-grievances/"')
    .replaceAll("export ", "");
  vm.runInContext(source, context);
  return {
    scripts,
    storage,
    context,
    run: (code) => vm.runInContext(code, context),
  };
}
test("US auto-start waits for region and does not persist automatic permission", async () => {
  let resolve;
  const f = fixture({ fetcher: () => new Promise((r) => (resolve = r)) });
  const pending = f.run("startAnalytics()");
  assert.equal(f.scripts.length, 0);
  resolve({ ok: true, json: async () => ({ requiresConsent: false }) });
  await pending;
  assert.equal(f.scripts.length, 1);
  assert.equal(f.storage.size, 0);
  f.run('trackAction("private-text");trackAction("grievance_filed")');
  const calls = f.context.window.dataLayer.map((a) => Array.from(a));
  assert.equal(
    calls.find((c) => c[0] === "config")[2].page_location,
    "https://cnoles1980.github.io/minor-grievances/404.html",
  );
  assert.ok(!JSON.stringify(calls).includes("private-"));
});
test("opt-in regions require explicit acceptance; refusal survives reload", async () => {
  const f = fixture();
  await f.run("startAnalytics()");
  assert.equal(f.scripts.length, 0);
  f.run('setAnalyticsChoice("allow")');
  assert.equal(f.scripts.length, 1);
  f.run('setAnalyticsChoice("deny")');
  assert.equal(f.context.window["ga-disable-G-2T6MFY7V8D"], true);
  const next = fixture({ policy: false, storage: f.storage });
  await next.run("startAnalytics()");
  assert.equal(next.scripts.length, 0);
});
test("lookup failures, malformed responses and unknown location fail closed", async () => {
  for (const fetcher of [
    async () => {
      throw Error("timeout");
    },
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => ({}) }),
  ]) {
    const f = fixture({ fetcher });
    await f.run("startAnalytics()");
    assert.equal(f.scripts.length, 0);
    assert.equal(f.run("getAnalyticsState().requiresConsent"), true);
  }
});
test("GPC overrides even saved consent; legacy denial is preserved", async () => {
  const f = fixture({ gpc: true, policy: false });
  f.run('setAnalyticsChoice("allow")');
  await f.run("startAnalytics()");
  assert.equal(f.scripts.length, 0);
  assert.equal(f.run("getAnalyticsState().blockedByGpc"), true);
  const old = fixture({ policy: false, storage: new Map([[key, "deny"]]) });
  await old.run("startAnalytics()");
  assert.equal(old.scripts.length, 0);
  const oldAllow = fixture({ storage: new Map([[key, "allow"]]) });
  await oldAllow.run("startAnalytics()");
  assert.equal(oldAllow.scripts.length, 0);
});
test("a delayed US lookup cannot override a newer opt-out", async () => {
  let resolve;
  const f = fixture({ fetcher: () => new Promise((r) => (resolve = r)) });
  const pending = f.run("startAnalytics()");
  f.run('setAnalyticsChoice("deny")');
  resolve({ ok: true, json: async () => ({ requiresConsent: false }) });
  await pending;
  assert.equal(f.scripts.length, 0);
});
test("saved explicit consent expires and is honored before expiry", async () => {
  const storage = new Map([
    [
      key + "-regional-v1",
      JSON.stringify({ choice: "allow", expires: Date.now() - 1000 }),
    ],
  ]);
  const expired = fixture({ storage });
  await expired.run("startAnalytics()");
  assert.equal(expired.scripts.length, 0);
  expired.run('setAnalyticsChoice("allow")');
  const valid = fixture({ storage });
  await valid.run("startAnalytics()");
  assert.equal(valid.scripts.length, 1);
});
