import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
const visitor = "test-browser-00000001";
async function fixture(fn) {
  const { app, db } = createApp({
    dbPath: ":memory:",
    secret: "test-secret",
    adminToken: "test-admin-token",
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, body, headers = {}) =>
    fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Visitor": visitor,
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  try {
    await fn(request, db);
  } finally {
    await new Promise((r) => server.close(r));
    db.close();
  }
}
const note = {
  text: "A test complaint about testing.",
  signature: "QA",
  category: "Tech",
  color: "yellow",
};
test("create, persist, deduplicate votes, share across visitors, report and moderate", () =>
  fixture(async (request) => {
    const created = await request("/api/notes", note);
    assert.equal(created.status, 201);
    const n = await created.json();
    assert.equal(n.votes, 0);
    const a = await (await request(`/api/notes/${n.id}/endorse`, {})).json();
    assert.equal(a.votes, 1);
    const b = await (await request(`/api/notes/${n.id}/endorse`, {})).json();
    assert.equal(b.votes, 1);
    const c = await (
      await request(
        `/api/notes/${n.id}/endorse`,
        {},
        { "X-Visitor": "test-browser-00000002" },
      )
    ).json();
    assert.equal(c.votes, 2);
    assert.equal(
      (await (await request("/api/notes")).json())[0].endorsed,
      true,
    );
    assert.equal((await request(`/api/notes/${n.id}/report`, {})).status, 200);
    assert.equal((await request("/admin/reports")).status, 401);
    const headers = { Authorization: "Bearer test-admin-token" };
    assert.equal(
      (await (await request("/admin/reports", undefined, headers)).json())[0]
        .reports,
      1,
    );
    await request(`/admin/notes/${n.id}/hide`, {}, headers);
    assert.equal((await (await request("/api/notes")).json()).length, 0);
    assert.equal((await request(`/api/notes/${n.id}/endorse`, {})).status, 404);
    await request(`/admin/notes/${n.id}/restore`, {}, headers);
    assert.equal((await (await request("/api/notes")).json()).length, 1);
  }));
test("reject malformed content, invalid identities, disallowed origins and excessive requests", () =>
  fixture(async (request) => {
    for (const invalid of [
      { ...note, text: "a" },
      { ...note, text: "x".repeat(241) },
      { ...note, color: "red" },
      { ...note, signature: "a".repeat(41) },
      { ...note, category: "Bad" },
    ])
      assert.equal((await request("/api/notes", invalid)).status, 400);
    assert.equal(
      (await request("/api/notes", note, { "X-Visitor": "bad" })).status,
      400,
    );
    assert.equal(
      (
        await request("/api/notes", note, {
          Origin: "https://malicious.example",
        })
      ).status,
      403,
    );
    for (let i = 0; i < 5; i++)
      assert.equal((await request("/api/notes", note)).status, 201);
    const limited = await request("/api/notes", note);
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.get("Retry-After"));
  }));
test("SQL-like and HTML input remain inert text", () =>
  fixture(async (request) => {
    const text = "<img src=x onerror=alert(1)> '; DROP TABLE notes; --";
    const response = await request("/api/notes", { ...note, text });
    assert.equal(response.status, 201);
    assert.equal((await (await request("/api/notes")).json())[0].text, text);
  }));
test("cursor pagination does not skip older notes when new notes arrive; filters and direct links work", () =>
  fixture(async (request, db) => {
    const insert = db.prepare(
      "INSERT INTO notes(id,text,signature,category,color,created) VALUES(?,?,?,?,?,?)",
    );
    for (let i = 0; i < 90; i++)
      insert.run(
        `page-${String(i).padStart(3, "0")}`,
        `Complaint ${i}`,
        "QA",
        i % 2 ? "Tech" : "Home",
        "yellow",
        1000 + i,
      );
    const first = await (await request("/api/notes")).json();
    assert.equal(first.length, 80);
    insert.run("newest", "A new complaint", "QA", "Tech", "pink", 5000);
    const last = first.at(-1);
    const next = await (
      await request(`/api/notes?before=${last.created}&beforeId=${last.id}`)
    ).json();
    assert.equal(next.length, 10);
    assert.equal(new Set([...first, ...next].map((n) => n.id)).size, 90);
    const filtered = await (
      await request("/api/notes?category=Tech&q=Complaint%2089")
    ).json();
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, "page-089");
    assert.equal(
      (await (await request("/api/notes/page-000")).json()).id,
      "page-000",
    );
    assert.equal(
      (await (await request("/api/random?category=Home")).json()).category,
      "Home",
    );
  }));

test("all four sorts traverse multiple pages with deterministic ties and filters", () =>
  fixture(async (request, db) => {
    const insert = db.prepare(
      "INSERT INTO notes(id,text,signature,category,color,votes,created) VALUES(?,?,?,?,?,?,?)",
    );
    const expected = [];
    for (let i = 0; i < 170; i++) {
      const n = {
        id: `sort-${String(i).padStart(3, "0")}`,
        created: 1000 + Math.floor(i / 3),
        votes: i % 9,
      };
      expected.push(n);
      insert.run(
        n.id,
        `Complaint ${i}`,
        "QA",
        i % 2 ? "Tech" : "Home",
        "pink",
        n.votes,
        n.created,
      );
    }
    const tie = (a, b) => a.created - b.created || a.id.localeCompare(b.id);
    const comparisons = {
      recent: (a, b) => -tie(a, b),
      oldest: tie,
      most: (a, b) => b.votes - a.votes || -tie(a, b),
      least: (a, b) => a.votes - b.votes || tie(a, b),
    };
    for (const [sort, compare] of Object.entries(comparisons)) {
      let cursor = "",
        found = [];
      for (let page = 0; page < 3; page++) {
        const response = await request(`/api/notes?sort=${sort}${cursor}`);
        assert.equal(response.status, 200);
        const rows = await response.json();
        found.push(...rows);
        const last = rows.at(-1);
        cursor = `&before=${last.created}&beforeId=${last.id}&beforeVotes=${last.votes}`;
      }
      assert.deepEqual(
        found.map((n) => n.id),
        [...expected].sort(compare).map((n) => n.id),
      );
      const filtered = await (
        await request(`/api/notes?sort=${sort}&category=Tech&q=Complaint%201`)
      ).json();
      assert.ok(
        filtered.every(
          (n) => n.category === "Tech" && n.text.includes("Complaint 1"),
        ),
      );
      assert.deepEqual(filtered, [...filtered].sort(compare));
    }
    assert.deepEqual(
      (await (await request("/api/notes")).json()).map((n) => n.id),
      [...expected]
        .sort(comparisons.recent)
        .slice(0, 80)
        .map((n) => n.id),
    );
    for (const query of [
      "sort=__proto__",
      "sort=recent%3BDROP%20TABLE%20notes",
      "before=Infinity",
      "before=-1",
      "beforeVotes=NaN",
    ])
      assert.equal((await request("/api/notes?" + query)).status, 400);
  }));

test("read and moderator limits cannot be bypassed with spoofed visitor or forwarded headers", () =>
  fixture(async (request) => {
    for (let i = 0; i < 30; i++)
      assert.equal(
        (
          await request("/admin/reports", undefined, {
            Authorization: "Bearer wrong",
            "X-Forwarded-For": `192.0.2.${i}`,
          })
        ).status,
        401,
      );
    assert.equal((await request("/admin/reports")).status, 429);
    for (let i = 0; i < 400; i++)
      assert.equal(
        (
          await request("/api/notes", undefined, {
            "X-Visitor": `different-browser-${i}`,
            "X-Forwarded-For": `198.51.100.${i % 255}`,
          })
        ).status,
        200,
      );
    assert.equal((await request("/api/random")).status, 429);
  }));

test("security headers, oversized payloads and unauthenticated moderation are safe", () =>
  fixture(async (request) => {
    const r = await request("/api/notes");
    assert.equal(r.headers.get("X-Frame-Options"), "DENY");
    assert.match(
      r.headers.get("Content-Security-Policy"),
      /frame-ancestors 'none'/,
    );
    assert.equal(
      (await request("/api/notes", { ...note, text: "x".repeat(5000) })).status,
      413,
    );
    assert.equal((await request("/admin/notes/missing/hide", {})).status, 401);
  }));

test("slur guard rejects text and signatures before persistence but permits profanity", () =>
  fixture(async (request, db) => {
    for (const body of [
      { ...note, text: "n1gg3r" },
      { ...note, signature: "wetback" },
    ]) {
      const r = await request("/api/notes", body);
      assert.equal(r.status, 400);
      assert.match((await r.json()).error, /Racial slurs/);
    }
    assert.equal(
      db.prepare("SELECT count(*) AS count FROM notes").get().count,
      0,
    );
    assert.equal(
      (
        await request("/api/notes", {
          ...note,
          text: "This fucking printer is shit.",
        })
      ).status,
      201,
    );
  }));
