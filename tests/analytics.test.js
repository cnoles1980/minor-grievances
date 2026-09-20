import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

test("analytics defaults on, respects saved opt-outs and excludes private content", () => {
  const scripts = [],
    storage = new Map();
  const context = vm.createContext({
    window: {},
    location: {
      hostname: "cnoles1980.github.io",
      origin: "https://cnoles1980.github.io",
      pathname: "/minor-grievances/private-missing-path",
      search: "?q=private-text",
      hash: "#private-id",
    },
    localStorage: {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
    },
    document: {
      cookie: "",
      createElement: () => ({}),
      head: { appendChild: (node) => scripts.push(node) },
    },
  });
  const source = readFileSync(
    new URL("../src/analytics.js", import.meta.url),
    "utf8",
  )
    .replaceAll("import.meta.env.VITE_GA4_ID", '"G-2T6MFY7V8D"')
    .replaceAll("import.meta.env.BASE_URL", '"/minor-grievances/"')
    .replaceAll("export ", "");
  vm.runInContext(source, context);
  assert.equal(scripts.length, 0);
  vm.runInContext('setAnalyticsChoice("deny"); startAnalytics()', context);
  assert.equal(scripts.length, 0);
  storage.clear();
  vm.runInContext("startAnalytics()", context);
  assert.equal(scripts.length, 1);
  assert.equal(
    storage.size,
    0,
    "automatic startup must not record explicit consent",
  );
  vm.runInContext(
    'setAnalyticsChoice("allow"); trackAction("private-text"); trackAction("grievance_filed")',
    context,
  );
  assert.equal(scripts.length, 1);
  assert.equal(
    scripts[0].src,
    "https://www.googletagmanager.com/gtag/js?id=G-2T6MFY7V8D",
  );
  const calls = context.window.dataLayer.map((args) => Array.from(args));
  assert.equal(
    calls.find((c) => c[0] === "config")[2].page_location,
    "https://cnoles1980.github.io/minor-grievances/404.html",
  );
  assert.ok(!JSON.stringify(calls).includes("private-"));
  const length = calls.length;
  vm.runInContext(
    'setAnalyticsChoice("deny"); trackAction("grievance_filed")',
    context,
  );
  assert.equal(context.window.dataLayer.length, length);
  assert.equal(context.window["ga-disable-G-2T6MFY7V8D"], true);
  vm.runInContext("startAnalytics()", context);
  assert.equal(context.window["ga-disable-G-2T6MFY7V8D"], true);
});
