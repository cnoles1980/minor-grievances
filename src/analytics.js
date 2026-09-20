const id = import.meta.env.VITE_GA4_ID || "";
export const analyticsAvailable =
  /^G-[A-Z0-9]+$/.test(id) &&
  !["localhost", "127.0.0.1"].includes(location.hostname);
const key = `bureau-analytics-${id}`;
let active = false,
  initialized = false;
export function analyticsChoice() {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function gtag() {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(arguments);
}
export function setAnalyticsChoice(choice) {
  try {
    localStorage.setItem(key, choice);
  } catch {}
  active = choice === "allow" && analyticsAvailable;
  window[`ga-disable-${id}`] = !active;
  if (!active) {
    for (const name of ["_ga", `_ga_${id.slice(2)}`])
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    return;
  }
  if (initialized) return;
  initialized = true;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);
  gtag("js", new Date());
  const base = import.meta.env.BASE_URL;
  const isHome = [base, `${base}index.html`, base.replace(/\/$/, "")].includes(
    location.pathname,
  );
  // Never send user-authored text, signatures, queries, fragments, or arbitrary 404 URLs.
  gtag("config", id, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_domain: "none",
    cookie_flags: "SameSite=Lax;Secure",
    page_location: `${location.origin}${base}${isHome ? "" : "404.html"}`,
    page_referrer: "",
    page_title: isHome ? "The Bureau of Minor Grievances" : "Complaint 404",
  });
  gtag("event", "page_view");
}
const allowed = new Set([
  "grievance_filed",
  "grievance_endorsed",
  "sort_changed",
]);
export function trackAction(name) {
  if (active && allowed.has(name)) gtag("event", name);
}
