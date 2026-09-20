const [action, id] = process.argv.slice(2);
if (!["list", "hide", "restore"].includes(action) || (action !== "list" && !id))
  throw new Error("Usage: node scripts/moderate.mjs list|hide ID|restore ID");
const token = process.env.ADMIN_TOKEN;
if (!token)
  throw new Error("Set ADMIN_TOKEN in this terminal environment first.");
const base = (process.env.BUREAU_API_URL || "http://127.0.0.1:4317").replace(
  /\/$/,
  "",
);
const url = new URL(base);
if (
  url.protocol !== "https:" &&
  !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
)
  throw new Error("Remote moderation requires HTTPS.");
const path =
  action === "list"
    ? "/admin/reports"
    : `/admin/notes/${encodeURIComponent(id)}/${action}`;
const response = await fetch(base + path, {
  method: action === "list" ? "GET" : "POST",
  headers: { Authorization: `Bearer ${token}` },
});
if (!response.ok)
  throw new Error(`Moderation failed (HTTP ${response.status}).`);
console.log(JSON.stringify(await response.json(), null, 2));
