import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker from "../cloudflare/api.js";

// Exercise the Worker against real SQLite, with D1's statement/result interface.
function fixture() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(
    readFileSync(
      new URL("../cloudflare/migrations/0001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  const DB = {
    prepare(query) {
      let values = [];
      return {
        bind(...args) {
          values = args;
          return this;
        },
        async first() {
          return sql.prepare(query).get(...values) || null;
        },
        async all() {
          return { results: sql.prepare(query).all(...values) };
        },
        async run() {
          return { meta: sql.prepare(query).run(...values) };
        },
        async execute() {
          return this.all();
        },
      };
    },
    async batch(statements) {
      sql.exec("BEGIN");
      try {
        const result = [];
        for (const s of statements) result.push(await s.execute());
        sql.exec("COMMIT");
        return result;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const env = {
    DB,
    ADMIN_TOKEN: "a".repeat(64),
    RATE_LIMIT_SECRET: "b".repeat(64),
    ALLOWED_ORIGIN: "https://example.com",
  };
  const request = async (path, body, headers = {}) =>
    worker.fetch(
      new Request("https://api.example.com" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "CF-Connecting-IP": "192.0.2.1",
          "X-Visitor": "visitor-00000000000001",
          Origin: env.ALLOWED_ORIGIN,
          "Content-Type": "application/json",
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      env,
    );
  return { sql, request, env };
}

test("Worker validates, deduplicates votes, protects moderation, and hides reported notes", async () => {
  const { sql, request, env } = fixture();
  try {
    assert.equal(
      (
        await request("/api/notes", undefined, {
          Origin: "https://evil.example",
        })
      ).status,
      403,
    );
    assert.equal((await request("/api/notes", { text: "x" })).status, 400);
    const result = await request("/api/notes", {
      text: "<script>alert(1)</script>",
      signature: "O'Reilly",
      category: "Tech",
      color: "yellow",
    });
    assert.equal(result.status, 201);
    const note = await result.json();
    assert.equal(note.votes, 0);
    for (let i = 0; i < 2; i++)
      assert.equal(
        (await (await request(`/api/notes/${note.id}/endorse`, {})).json())
          .votes,
        1,
      );
    assert.equal(
      (
        await (
          await request(
            `/api/notes/${note.id}/endorse`,
            {},
            { "X-Visitor": "visitor-00000000000002" },
          )
        ).json()
      ).votes,
      2,
    );
    assert.equal(
      (await request(`/api/notes/${note.id}/report`, {})).status,
      200,
    );
    assert.equal((await request("/admin/reports")).status, 401);
    const admin = { Authorization: `Bearer ${env.ADMIN_TOKEN}` };
    assert.equal(
      (await (await request("/admin/reports", undefined, admin)).json()).length,
      1,
    );
    assert.equal(
      (await request(`/admin/notes/${note.id}/hide`, {}, admin)).status,
      200,
    );
    assert.equal((await request(`/api/notes/${note.id}`)).status, 404);
    assert.deepEqual(await (await request("/api/notes")).json(), []);
    assert.equal(
      (await request(`/admin/notes/${note.id}/restore`, {}, admin)).status,
      200,
    );
    assert.equal((await request(`/api/notes/${note.id}`)).status, 200);
  } finally {
    sql.close();
  }
});

test("Worker limits writes and rejects malformed cursors and oversized bodies", async () => {
  const { sql, request } = fixture();
  try {
    assert.equal((await request("/api/notes?sort=invalid")).status, 400);
    assert.equal((await request("/api/notes?before=-1")).status, 400);
    assert.equal(
      (await request("/api/notes", { text: "x".repeat(5000) })).status,
      413,
    );
    for (let i = 0; i < 4; i++)
      assert.equal(
        (
          await request("/api/notes", {
            text: "Test grievance",
            category: "Tech",
            color: "blue",
          })
        ).status,
        201,
      );
    const denied = await request("/api/notes", {
      text: "Test grievance",
      category: "Tech",
      color: "blue",
    });
    assert.equal(denied.status, 429);
    assert.ok(Number(denied.headers.get("Retry-After")) > 0);
  } finally {
    sql.close();
  }
});

test("regional policy uses trusted country metadata and ignores spoofed headers", async () => {
  for (const [country, expected] of [
    ["US", false],
    ["DE", true],
    ["GB", true],
    ["CH", true],
    ["BR", true],
    ["CA", true],
    [undefined, true],
  ]) {
    const request = new Request("https://api.example.com/api/consent-policy", {
      headers: { Origin: "https://example.com", "CF-IPCountry": "US" },
    });
    if (country) request.cf = { country };
    const response = await worker.fetch(request, {
      ALLOWED_ORIGIN: "https://example.com",
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal((await response.json()).requiresConsent, expected);
  }
});
