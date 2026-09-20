import express from "express";
import {
  violatesContentPolicy,
  contentPolicyMessage,
} from "./content-policy.js";
import { DatabaseSync } from "node:sqlite";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { seed, categories, colors } from "../src/seed.js";
export function createApp({
  dbPath = "data/bureau.sqlite",
  demo = false,
  adminToken = process.env.ADMIN_TOKEN,
  secret = process.env.RATE_LIMIT_SECRET || randomUUID(),
  allowedOrigin = process.env.ALLOWED_ORIGIN || "http://127.0.0.1:4173",
} = {}) {
  if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS notes(id TEXT PRIMARY KEY,text TEXT NOT NULL,signature TEXT NOT NULL,category TEXT NOT NULL,color TEXT NOT NULL,votes INTEGER NOT NULL DEFAULT 0,demo INTEGER NOT NULL DEFAULT 0,hidden INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS endorsements(note_id TEXT REFERENCES notes(id),visitor TEXT,PRIMARY KEY(note_id,visitor));
 CREATE TABLE IF NOT EXISTS reports(note_id TEXT REFERENCES notes(id),visitor TEXT,created INTEGER,PRIMARY KEY(note_id,visitor));
 CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,count INTEGER,expires INTEGER);`);
  db.exec(`CREATE INDEX IF NOT EXISTS notes_recent ON notes(hidden,created,id);
    CREATE INDEX IF NOT EXISTS notes_votes ON notes(hidden,votes,created,id);
    CREATE INDEX IF NOT EXISTS limits_expiry ON limits(expires);`);
  if (demo && db.prepare("SELECT count(*) AS n FROM notes").get().n === 0) {
    const insert = db.prepare(
      "INSERT INTO notes(id,text,signature,category,color,votes,demo,created) VALUES(?,?,?,?,?,?,1,?)",
    );
    const seededAt = Date.now();
    seed.forEach((n, i) =>
      insert.run(
        n.id,
        n.text,
        n.signature,
        n.category,
        n.color,
        n.votes,
        seededAt - i,
      ),
    );
  }
  const app = express();
  app.disable("x-powered-by");
  // Keep trust proxy disabled: forwarded IP headers must not bypass rate limits.
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "Cache-Control": "no-store",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy":
        "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
    const origin = req.get("origin");
    if (origin && origin !== allowedOrigin)
      return res.status(403).json({ error: "Origin not allowed." });
    if (origin) {
      res.set({
        "Access-Control-Allow-Origin": allowedOrigin,
        Vary: "Origin",
        "Access-Control-Allow-Headers": "Content-Type,X-Visitor,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      });
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: "4kb" }));
  const hash = (value) =>
    createHmac("sha256", secret).update(value).digest("hex");
  function throttle(req, res, type, max) {
    const now = Date.now();
    db.prepare("DELETE FROM limits WHERE expires < ?").run(now);
    const key = hash(`${req.ip}:${type}`);
    const prior = db.prepare("SELECT * FROM limits WHERE key=?").get(key);
    if (prior && prior.count >= max) {
      res.set("Retry-After", String(Math.ceil((prior.expires - now) / 1000)));
      res.status(429).json({
        error: "A lot of feelings. Please give the Bureau a few minutes.",
      });
      return false;
    }
    db.prepare(
      "INSERT INTO limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
    ).run(key, now + 600000);
    return true;
  }
  app.use("/api", (req, res, next) => {
    if (!throttle(req, res, "requests", 400)) return;
    const visitor = req.get("X-Visitor");
    if (!visitor || !/^[a-zA-Z0-9-]{16,80}$/.test(visitor))
      return res
        .status(400)
        .json({ error: "A valid anonymous browser ID is required." });
    req.visitor = hash(visitor);
    next();
  });
  const publicNote = (n) => ({ ...n, demo: !!n.demo, endorsed: !!n.endorsed });
  const select = `SELECT n.id,n.text,n.signature,n.category,n.color,n.votes,n.demo,n.created,EXISTS(SELECT 1 FROM endorsements e WHERE e.note_id=n.id AND e.visitor=?) AS endorsed FROM notes n`;
  // SQL fragments come only from this fixed allowlist, never from user input.
  const sortOrders = {
    recent: { direction: "DESC", comparison: "<", votes: false },
    oldest: { direction: "ASC", comparison: ">", votes: false },
    most: { direction: "DESC", comparison: "<", votes: true },
    least: { direction: "ASC", comparison: ">", votes: true },
  };
  app.get("/api/notes", (req, res) => {
    const sort = String(req.query.sort || "recent");
    if (!Object.hasOwn(sortOrders, sort))
      return res.status(400).json({ error: "Choose a valid sort order." });
    const before = Number(req.query.before || 0),
      votes = Number(req.query.beforeVotes || 0);
    const beforeId = String(req.query.beforeId || "").slice(0, 80);
    if (![before, votes].every((n) => Number.isSafeInteger(n) && n >= 0))
      return res.status(400).json({ error: "Invalid page cursor." });
    const query = String(req.query.q || "").slice(0, 240),
      category = String(req.query.category || "All");
    const { direction, comparison, votes: byVotes } = sortOrders[sort];
    const columns = byVotes ? "n.votes,n.created,n.id" : "n.created,n.id";
    const values = byVotes ? [votes, before, beforeId] : [before, beforeId];
    const cursorClause = beforeId
      ? `AND (${columns}) ${comparison} (${values.map(() => "?").join(",")})`
      : "";
    const order = columns
      .split(",")
      .map((column) => `${column} ${direction}`)
      .join(",");
    res.json(
      db
        .prepare(
          `${select} WHERE n.hidden=0 AND (?='All' OR n.category=?) AND instr(lower(n.text || ' ' || n.signature),lower(?))>0 ${cursorClause} ORDER BY ${order} LIMIT 80`,
        )
        .all(
          req.visitor,
          category,
          category,
          query,
          ...(beforeId ? values : []),
        )
        .map(publicNote),
    );
  });
  app.get("/api/random", (req, res) => {
    const category = String(req.query.category || "All"),
      query = String(req.query.q || "").slice(0, 240);
    const n = db
      .prepare(
        `${select} WHERE n.hidden=0 AND (?='All' OR n.category=?) AND instr(lower(n.text || ' ' || n.signature),lower(?))>0 ORDER BY random() LIMIT 1`,
      )
      .get(req.visitor, category, category, query);
    if (!n) return res.status(404).json({ error: "No grievances found." });
    res.json(publicNote(n));
  });
  app.get("/api/notes/:id", (req, res) => {
    const n = db
      .prepare(`${select} WHERE n.id=? AND hidden=0`)
      .get(req.visitor, req.params.id);
    if (!n)
      return res
        .status(404)
        .json({ error: "This complaint is no longer on the wall." });
    res.json(publicNote(n));
  });
  app.post("/api/notes", (req, res) => {
    const { text, signature = "", category, color } = req.body || {};
    if (
      typeof text !== "string" ||
      text.trim().length < 3 ||
      text.length > 240 ||
      typeof signature !== "string" ||
      signature.length > 40 ||
      !categories.includes(category) ||
      !colors.includes(color)
    )
      return res.status(400).json({
        error:
          "Use 3–240 characters, a signature of 40 characters or fewer, and a valid category and paper color.",
      });
    if (!throttle(req, res, "post", 5)) return;
    if (violatesContentPolicy(text, signature))
      return res.status(400).json({ error: contentPolicyMessage });
    const id = randomUUID();
    db.prepare(
      "INSERT INTO notes(id,text,signature,category,color,created) VALUES(?,?,?,?,?,?)",
    ).run(
      id,
      text.trim(),
      signature.trim() || "Anonymous",
      category,
      color,
      Date.now(),
    );
    res
      .status(201)
      .json(
        publicNote(db.prepare(`${select} WHERE n.id=?`).get(req.visitor, id)),
      );
  });
  app.param("id", (req, res, next, id) => {
    if (!db.prepare("SELECT id FROM notes WHERE id=? AND hidden=0").get(id))
      return res
        .status(404)
        .json({ error: "This complaint is no longer on the wall." });
    next();
  });
  app.post("/api/notes/:id/endorse", (req, res) => {
    if (!throttle(req, res, "endorse", 100)) return;
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = db
        .prepare(
          "INSERT OR IGNORE INTO endorsements(note_id,visitor) VALUES(?,?)",
        )
        .run(req.params.id, req.visitor);
      if (result.changes)
        db.prepare("UPDATE notes SET votes=votes+1 WHERE id=?").run(
          req.params.id,
        );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    res.json({
      votes: db.prepare("SELECT votes FROM notes WHERE id=?").get(req.params.id)
        .votes,
      endorsed: true,
    });
  });
  app.post("/api/notes/:id/report", (req, res) => {
    if (!throttle(req, res, "report", 20)) return;
    db.prepare(
      "INSERT OR IGNORE INTO reports(note_id,visitor,created) VALUES(?,?,?)",
    ).run(req.params.id, req.visitor, Date.now());
    res.json({ ok: true });
  });
  app.use("/admin", (req, res, next) => {
    if (!throttle(req, res, "admin", 30)) return;
    const token = req.get("Authorization")?.replace(/^Bearer /, "") || "";
    if (
      !adminToken ||
      Buffer.byteLength(token) !== Buffer.byteLength(adminToken) ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(adminToken))
    )
      return res.status(401).json({ error: "Unauthorized" });
    next();
  });
  app.get("/admin/reports", (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT n.*,count(r.visitor) AS reports FROM notes n JOIN reports r ON r.note_id=n.id GROUP BY n.id ORDER BY reports DESC",
        )
        .all(),
    ),
  );
  app.post("/admin/notes/:noteId/hide", (req, res) => {
    const result = db
      .prepare("UPDATE notes SET hidden=1 WHERE id=?")
      .run(req.params.noteId);
    res.status(result.changes ? 200 : 404).json({ ok: !!result.changes });
  });
  app.post("/admin/notes/:noteId/restore", (req, res) => {
    const result = db
      .prepare("UPDATE notes SET hidden=0 WHERE id=?")
      .run(req.params.noteId);
    res.status(result.changes ? 200 : 404).json({ ok: !!result.changes });
  });
  app.use(
    express.static(resolve("dist/client"), {
      setHeaders(res) {
        res.setHeader("Cache-Control", "public, max-age=300");
      },
    }),
  );
  app.use((req, res) => {
    if (
      req.method === "GET" &&
      !req.path.startsWith("/api/") &&
      !req.path.startsWith("/admin/") &&
      req.accepts("html")
    ) {
      return res.status(404).sendFile(resolve("dist/client/404.html"));
    }
    res.status(404).json({
      error: "This page has gone missing. A grievance has been filed.",
    });
  });
  app.use((err, req, res, next) => {
    console.error(
      `[bureau] ${req.method} ${req.path}: ${err.type || err.name}`,
    );
    res
      .status(
        err.status === 413
          ? 413
          : err.type === "entity.parse.failed"
            ? 400
            : 500,
      )
      .json({
        error:
          err.status === 413
            ? "That filing is too large."
            : err.type === "entity.parse.failed"
              ? "Invalid request."
              : "The filing cabinet jammed. Please try again.",
      });
  });
  return { app, db };
}
