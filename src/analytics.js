const id = import.meta.env.VITE_GA4_ID || "";
export const analyticsAvailable =
  /^G-[A-Z0-9]+$/.test(id) &&
  !["localhost", "127.0.0.1"].includes(location.hostname);
const key = `bureau-analytics-${id}`;
const preferenceKey = `${key}-regional-v1`;
const preferenceLifetime = 180 * 24 * 60 * 60 * 1000;
let revision = 0;
let state = {
  pending: analyticsAvailable,
  active: false,
  requiresConsent: true,
  blockedByGpc: false,
};
const listeners = new Set();
export const getAnalyticsState = () => state;
export function subscribeAnalytics(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function updateState(values) {
  state = { ...state, ...values };
  for (const listener of listeners) listener();
}
const privacySignal = () =>
  typeof navigator !== "undefined" && navigator.globalPrivacyControl === true;
let active = false,
  initialized = false;
export function analyticsChoice() {
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey) || "null");
    if (
      saved &&
      saved.expires > Date.now() &&
      ["allow", "deny"].includes(saved.choice)
    )
      return saved.choice;
    // Previous refusals remain valid. Legacy allowances are not assumed to be consent.
    return localStorage.getItem(key) === "deny" ? "deny" : null;
  } catch {
    return null;
  }
}
function gtag() {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(arguments);
}
export async function startAnalytics() {
  const version = ++revision;
  const choice = analyticsChoice();
  if (!analyticsAvailable || privacySignal() || choice) {
    setAnalyticsChoice(choice || "deny", false);
    return;
  }
  // No Google tag is loaded while location is unresolved. Failed lookup requires opt-in.
  let requiresConsent = true;
  try {
    const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
    const response = await fetch(`${base}/api/consent-policy`, {
      signal: AbortSignal.timeout(4000),
      credentials: "omit",
      cache: "no-store",
    });
    if (response.ok)
      requiresConsent = (await response.json()).requiresConsent !== false;
  } catch {
    /* Leave analytics off on timeouts, blockers and network errors. */
  }
  if (version !== revision) return;
  updateState({ pending: false, requiresConsent });
  if (!requiresConsent) setAnalyticsChoice("allow", false);
}
export function setAnalyticsChoice(choice, persist = true) {
  revision++;
  try {
    if (persist) {
      localStorage.setItem(
        preferenceKey,
        JSON.stringify({ choice, expires: Date.now() + preferenceLifetime }),
      );
      localStorage.removeItem(key);
    }
  } catch {}
  active = choice === "allow" && analyticsAvailable && !privacySignal();
  updateState({
    pending: false,
    active,
    blockedByGpc: privacySignal(),
    decided: persist || !!analyticsChoice(),
  });
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
  const isPrivacy = [
    `${base}privacy/`,
    `${base}privacy`,
    `${base}privacy/index.html`,
  ].includes(location.pathname);
  // Never send user-authored text, signatures, queries, fragments, or arbitrary 404 URLs.
  gtag("config", id, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_domain: "none",
    cookie_flags: "SameSite=Lax;Secure",
    page_location: `${location.origin}${base}${isHome ? "" : isPrivacy ? "privacy/" : "404.html"}`,
    page_referrer: "",
    page_title: isHome
      ? "The Bureau of Minor Grievances"
      : isPrivacy
        ? "Privacy"
        : "Complaint 404",
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
