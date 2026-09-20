import { seed } from "./seed.js";
// Explicit public preview: illustrative content only, never pretend to save writes.
export function previewResponse(path, body) {
  if (body)
    throw new Error(
      "This is a read-only preview. Shared filing is not connected yet.",
    );
  const url = new URL(path, "https://preview.invalid");
  const query = (url.searchParams.get("q") || "").toLowerCase(),
    category = url.searchParams.get("category") || "All",
    sort = url.searchParams.get("sort") || "recent";
  let notes = seed
    .map((n, i) => ({ ...n, created: 100000 - i, endorsed: false }))
    .filter(
      (n) =>
        (category === "All" || n.category === category) &&
        `${n.text} ${n.signature}`.toLowerCase().includes(query),
    );
  if (url.pathname.startsWith("/notes/")) {
    const id = decodeURIComponent(url.pathname.slice(7));
    const n = notes.find((n) => n.id === id);
    if (!n) throw new Error("This complaint is no longer on the wall.");
    return n;
  }
  if (url.pathname === "/random") {
    if (!notes.length) throw new Error("No grievances found.");
    return notes[Math.floor(Math.random() * notes.length)];
  }
  const tie = (a, b) => a.created - b.created || a.id.localeCompare(b.id);
  const order = {
    recent: (a, b) => -tie(a, b),
    oldest: tie,
    most: (a, b) => b.votes - a.votes || -tie(a, b),
    least: (a, b) => a.votes - b.votes || tie(a, b),
  };
  return notes.sort(order[sort] || order.recent);
}
