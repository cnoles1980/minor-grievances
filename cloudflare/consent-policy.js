// Conservative deployment policy, not an exhaustive classification of local laws.
// Only the US is enabled by default. Unreviewed/unknown regions require opt-in.
export function requiresAnalyticsConsent(country) {
  return country !== "US";
}
