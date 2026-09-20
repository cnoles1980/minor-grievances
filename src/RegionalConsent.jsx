import React, { useSyncExternalStore } from "react";
import {
  analyticsAvailable,
  analyticsChoice,
  getAnalyticsState,
  subscribeAnalytics,
  setAnalyticsChoice,
} from "./analytics";

export default function RegionalConsent() {
  const status = useSyncExternalStore(subscribeAnalytics, getAnalyticsState);
  if (
    !analyticsAvailable ||
    status.pending ||
    status.active ||
    status.decided ||
    status.blockedByGpc ||
    !status.requiresConsent ||
    analyticsChoice()
  )
    return null;
  return (
    <aside className="regional-consent" aria-label="Optional analytics">
      <p>
        <strong>A little less pointless paperwork?</strong>
        <br />
        Allow Google Analytics cookies to measure visits and basic actions? Your
        grievances and signatures are not included in our analytics events. The
        wall works either way.
      </p>
      <a href={`${import.meta.env.BASE_URL}privacy/`}>Privacy & analytics</a>
      <div>
        <button onClick={() => setAnalyticsChoice("deny")}>No thanks</button>
        <button onClick={() => setAnalyticsChoice("allow")}>
          Allow analytics
        </button>
      </div>
    </aside>
  );
}
