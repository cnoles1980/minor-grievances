import { timingSafeEqual } from "node:crypto";
import { requiresAnalyticsConsent } from "./consent-policy.js";
import { categories, colors } from "../src/seed.js";
const publicSelect = `SELECT n.id,n.text,n.signature,n.category,n.color,n.votes,n.demo,n.created,EXISTS(SELECT 1 FROM endorsements e WHERE e.note_id=n.id AND e.visitor=?) AS endorsed FROM notes n`;
const publicNote = (n) => ({ ...n, demo: !!n.demo, endorsed: !!n.endorsed });
const sortOrders = {
  recent: ["DESC", "<", false],
  oldest: ["ASC", ">", false],
  most: ["DESC", "<", true],
  least: ["ASC", ">", true],
};
const encode = new TextEncoder();
class HttpError extends Error {
  constructor(status, message, headers = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}
async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encode.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = await crypto.subtle.sign("HMAC", key, encode.encode(value));
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
async function tokenMatches(provided, expected) {
  if (!expected) return false;
  const [a, b] = await Promise.all(
    [provided, expected].map((value) =>
      crypto.subtle.digest("SHA-256", encode.encode(value)),
    ),
  );
  return timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
}
async function limit(db, key, max) {
  const now = Date.now();
  const previous = await db
    .prepare("SELECT count,expires FROM limits WHERE key=?")
    .bind(key)
    .first();
  if (previous && previous.expires > now && previous.count >= max)
    throw new HttpError(
      429,
      "A lot of feelings. Please give the Bureau a few minutes.",
      { "Retry-After": String(Math.ceil((previous.expires - now) / 1000)) },
    );
  const row = await db
    .prepare(
      `INSERT INTO limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<=? THEN ? ELSE expires END RETURNING count,expires`,
    )
    .bind(key, now + 600000, now, now, now + 600000)
    .first();
  if (row.count > max)
    throw new HttpError(
      429,
      "A lot of feelings. Please give the Bureau a few minutes.",
      { "Retry-After": String(Math.ceil((row.expires - now) / 1000)) },
    );
}
async function readBody(request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Send application/json.");
  if (Number(request.headers.get("content-length")) > 4096)
    throw new HttpError(413, "That filing is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Invalid request.");
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) {
      await reader.cancel();
      throw new HttpError(413, "That filing is too large.");
    }
    chunks.push(value);
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(data));
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}
async function route(request, env) {
  // Use Cloudflare's trusted connection metadata, never a client country header.
  // This endpoint does not read/write D1 or require an anonymous visitor ID.
  if (
    request.method === "GET" &&
    new URL(request.url).pathname === "/api/consent-policy"
  ) {
    return {
      data: { requiresConsent: requiresAnalyticsConsent(request.cf?.country) },
    };
  }
  if (!env.DB || !env.RATE_LIMIT_SECRET || !env.ADMIN_TOKEN)
    throw new HttpError(503, "The Bureau is not ready to accept filings yet.");
  const url = new URL(request.url),
    path = url.pathname,
    method = request.method,
    db = env.DB;
  if (!["GET", "POST"].includes(method))
    throw new HttpError(405, "Method not allowed.", {
      Allow: "GET, POST, OPTIONS",
    });
  // Cloudflare overwrites this header at its edge; never trust X-Forwarded-For.
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip) throw new HttpError(400, "Missing network identity.");
  const network = await hmac(env.RATE_LIMIT_SECRET, `ip:${ip}`);
  if (path.startsWith("/admin/")) {
    await limit(db, `admin:${network}`, 30);
    const token =
      request.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
    if (!(await tokenMatches(token, env.ADMIN_TOKEN)))
      throw new HttpError(401, "Unauthorized");
    if (method === "GET" && path === "/admin/reports")
      return {
        data: (
          await db
            .prepare(
              "SELECT n.*,count(r.visitor) AS reports FROM notes n JOIN reports r ON r.note_id=n.id GROUP BY n.id ORDER BY reports DESC LIMIT 200",
            )
            .all()
        ).results,
      };
    const match = path.match(
      /^\/admin\/notes\/([a-zA-Z0-9-]{1,80})\/(hide|restore)$/,
    );
    if (method === "POST" && match) {
      const result = await db
        .prepare("UPDATE notes SET hidden=? WHERE id=?")
        .bind(match[2] === "hide" ? 1 : 0, match[1])
        .run();
      if (!result.meta.changes)
        throw new HttpError(404, "Complaint not found.");
      return { data: { ok: true } };
    }
    throw new HttpError(404, "Administrative route not found.");
  }
  if (!path.startsWith("/api/"))
    throw new HttpError(
      404,
      "This page has gone missing. A grievance has been filed.",
    );
  await limit(db, `requests:${network}`, 400);
  const identity = request.headers.get("X-Visitor");
  if (!identity || !/^[a-zA-Z0-9-]{16,80}$/.test(identity))
    throw new HttpError(400, "A valid anonymous browser ID is required.");
  const visitor = await hmac(env.RATE_LIMIT_SECRET, `visitor:${identity}`);
  const params = url.searchParams,
    query = (params.get("q") || "").slice(0, 240),
    category = params.get("category") || "All";
  if (category !== "All" && !categories.includes(category))
    throw new HttpError(400, "Invalid category.");
  if (method === "GET" && path === "/api/notes") {
    const sort = params.get("sort") || "recent";
    if (!Object.hasOwn(sortOrders, sort))
      throw new HttpError(400, "Choose a valid sort order.");
    const before = Number(params.get("before") || 0),
      votes = Number(params.get("beforeVotes") || 0),
      beforeId = (params.get("beforeId") || "").slice(0, 80);
    if (![before, votes].every((n) => Number.isSafeInteger(n) && n >= 0))
      throw new HttpError(400, "Invalid page cursor.");
    const [direction, comparison, byVotes] = sortOrders[sort],
      columns = byVotes ? "n.votes,n.created,n.id" : "n.created,n.id",
      values = byVotes ? [votes, before, beforeId] : [before, beforeId];
    const cursor = beforeId
        ? `AND (${columns}) ${comparison} (${values.map(() => "?").join(",")})`
        : "",
      order = columns
        .split(",")
        .map((c) => `${c} ${direction}`)
        .join(",");
    const { results } = await db
      .prepare(
        `${publicSelect} WHERE n.hidden=0 AND (?='All' OR n.category=?) AND instr(lower(n.text || ' ' || n.signature),lower(?))>0 ${cursor} ORDER BY ${order} LIMIT 80`,
      )
      .bind(visitor, category, category, query, ...(beforeId ? values : []))
      .all();
    return { data: results.map(publicNote) };
  }
  if (method === "GET" && path === "/api/random") {
    const n = await db
      .prepare(
        `${publicSelect} WHERE n.hidden=0 AND (?='All' OR n.category=?) AND instr(lower(n.text || ' ' || n.signature),lower(?))>0 ORDER BY random() LIMIT 1`,
      )
      .bind(visitor, category, category, query)
      .first();
    if (!n) throw new HttpError(404, "No grievances found.");
    return { data: publicNote(n) };
  }
  if (method === "POST" && path === "/api/notes") {
    await limit(db, `post:${network}`, 5);
    const {
      text,
      signature = "",
      category,
      color,
    } = (await readBody(request)) || {};
    if (
      typeof text !== "string" ||
      text.trim().length < 3 ||
      text.length > 240 ||
      typeof signature !== "string" ||
      signature.length > 40 ||
      !categories.includes(category) ||
      !colors.includes(color)
    )
      throw new HttpError(
        400,
        "Use 3–240 characters, a signature of 40 characters or fewer, and a valid category and paper color.",
      );
    const id = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO notes(id,text,signature,category,color,created) VALUES(?,?,?,?,?,?)",
      )
      .bind(
        id,
        text.trim(),
        signature.trim() || "Anonymous",
        category,
        color,
        Date.now(),
      )
      .run();
    return {
      status: 201,
      data: publicNote(
        await db
          .prepare(`${publicSelect} WHERE n.id=?`)
          .bind(visitor, id)
          .first(),
      ),
    };
  }
  const match = path.match(
    /^\/api\/notes\/([a-zA-Z0-9-]{1,80})(?:\/(endorse|report))?$/,
  );
  if (match) {
    const [, id, action] = match,
      n = await db
        .prepare(`${publicSelect} WHERE n.id=? AND n.hidden=0`)
        .bind(visitor, id)
        .first();
    if (!n)
      throw new HttpError(404, "This complaint is no longer on the wall.");
    if (method === "GET" && !action) return { data: publicNote(n) };
    if (method === "POST" && action === "endorse") {
      await limit(db, `endorse:${network}`, 100);
      await readBody(request);
      const results = await db.batch([
        db
          .prepare(
            "INSERT OR IGNORE INTO endorsements(note_id,visitor) SELECT id,? FROM notes WHERE id=? AND hidden=0",
          )
          .bind(visitor, id),
        db.prepare("SELECT votes FROM notes WHERE id=? AND hidden=0").bind(id),
      ]);
      if (!results[1].results.length)
        throw new HttpError(404, "This complaint is no longer on the wall.");
      return { data: { votes: results[1].results[0].votes, endorsed: true } };
    }
    if (method === "POST" && action === "report") {
      await limit(db, `report:${network}`, 20);
      await readBody(request);
      await db
        .prepare(
          "INSERT OR IGNORE INTO reports(note_id,visitor,created) VALUES(?,?,?)",
        )
        .bind(id, visitor, Date.now())
        .run();
      return { data: { ok: true } };
    }
  }
  throw new HttpError(
    404,
    "This page has gone missing. A grievance has been filed.",
  );
}
export default {
  async fetch(request, env) {
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "same-origin",
      "Strict-Transport-Security": "max-age=31536000",
      Vary: "Origin",
    };
    const origin = request.headers.get("Origin");
    if (origin && origin !== env.ALLOWED_ORIGIN)
      return new Response(JSON.stringify({ error: "Origin not allowed." }), {
        status: 403,
        headers,
      });
    if (origin)
      Object.assign(headers, {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "Content-Type,X-Visitor,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Max-Age": "86400",
      });
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    try {
      const result = await route(request, env);
      return new Response(JSON.stringify(result.data), {
        status: result.status || 200,
        headers,
      });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) console.error("Bureau request failed:", error.name);
      return new Response(
        JSON.stringify({
          error:
            status === 500
              ? "The filing cabinet jammed. Please try again."
              : error.message,
        }),
        { status, headers: { ...headers, ...(error.headers || {}) } },
      );
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      env.DB.prepare("DELETE FROM limits WHERE expires<?")
        .bind(Date.now())
        .run(),
    );
  },
};
