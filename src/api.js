export const previewMode = import.meta.env.VITE_READ_ONLY_PREVIEW === "true";
const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const mediaUrl = id => `${base}/media/${encodeURIComponent(id)}`;
let visitor;
try {
  visitor = localStorage.getItem("bureau-visitor");
  if (!visitor) {
    visitor = crypto.randomUUID();
    localStorage.setItem("bureau-visitor", visitor);
  }
} catch {
  visitor = crypto.randomUUID();
}
export async function api(path, body) {
  if (previewMode) {
    const { previewResponse } = await import("./preview");
    return previewResponse(path, body);
  }
  const r = await fetch(`${base}/api${path}`, {
    signal: AbortSignal.timeout(15000),
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "X-Visitor": visitor },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data;
  try {
    data = await r.json();
  } catch {
    throw new Error("The filing cabinet is offline. Please try again.");
  }
  if (!r.ok)
    throw new Error(data.error || "The Bureau hit a snag. Please try again.");
  return data;
}
