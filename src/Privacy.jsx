import React, { useSyncExternalStore } from "react";
import {
  analyticsAvailable,
  getAnalyticsState,
  subscribeAnalytics,
  setAnalyticsChoice,
} from "./analytics";

export default function Privacy() {
  const status = useSyncExternalStore(subscribeAnalytics, getAnalyticsState);
  const disabled = !status.active;
  return (
    <main className="privacy-page">
      <article>
        <a href={import.meta.env.BASE_URL}>← Back to the grievances</a>
        <p className="privacy-kicker">
          DEPARTMENT OF LESS MYSTERIOUS PAPERWORK
        </p>
        <h1>Privacy, in plain English.</h1>
        <p>
          Last updated September 20, 2026. The Bureau of Minor Grievances is
          maintained by Corey Noles.
        </p>
        <h2>Your grievances are public</h2>
        <p>
          Posts and optional signatures appear on the public wall. Do not
          include private details about yourself or anyone else. Notes,
          endorsements, and reports are stored in Cloudflare D1. Reporting a
          note sends it for human review; it does not automatically remove it. A
          small automatic filter rejects explicit racial slurs in new posts and
          signatures. Rejected submissions are not saved to the grievance
          database or sent to an AI moderation service.
        </p>
        <h2>No account required</h2>
        <p>
          We keep a random browser ID in local storage to remember endorsements.
          The server stores a hashed version of that ID. Clearing browser
          storage resets it. To limit abuse, the server also uses a keyed hash
          of your IP address in short-lived rate-limit records, which expire
          after ten minutes and are periodically removed.
        </p>
        <h2>Traffic measurement</h2>
        <p>
          We use Google Analytics 4 to measure visits, sessions, and basic
          actions such as filing or endorsing a grievance. For visitors
          identified as being in the United States, it loads automatically
          unless they opt out. Elsewhere, or if location cannot be determined,
          we ask before loading it. Cloudflare supplies an approximate country
          from the connection; we do not request device location or store your
          country for this check. Global Privacy Control keeps analytics off in
          all regions. Google Analytics uses cookies such as _ga and _ga_* to
          distinguish browsers and sessions. We do not send grievance text,
          signatures, search terms, or note IDs in our analytics events, and
          advertising personalization is disabled.
        </p>
        <p>
          Google and our hosting providers process technical request information
          to provide their services. See{" "}
          <a href="https://policies.google.com/privacy">
            Google’s privacy policy
          </a>
          ,{" "}
          <a href="https://www.cloudflare.com/privacypolicy/">
            Cloudflare’s privacy policy
          </a>
          , and{" "}
          <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">
            GitHub’s privacy statement
          </a>
          .
        </p>
        <h2>Analytics preferences</h2>
        <p aria-live="polite">
          {!analyticsAvailable
            ? "Google Analytics is not enabled on this version of the site."
            : status.pending
              ? "Checking regional analytics preferences. Analytics is off while we check."
              : status.blockedByGpc
                ? "Analytics is off because your browser sends Global Privacy Control."
                : disabled
                  ? "Analytics is off for this browser."
                  : "Analytics is on for this browser."}
        </p>
        {analyticsAvailable && (
          <button
            disabled={status.pending || status.blockedByGpc}
            onClick={() => {
              setAnalyticsChoice(disabled ? "allow" : "deny");
            }}
          >
            {disabled ? "Enable analytics" : "Turn off analytics"}
          </button>
        )}
        <p>
          Your explicit choice is saved on this browser for 180 days. You can
          change it here at any time. Opting out stops future measurement; it
          does not erase information already sent. Browser settings can also
          block or remove cookies. The wall works with analytics off.
        </p>
        <h2>Retention and requests</h2>
        <p>
          Posts remain until moderated or removed; hidden notes and associated
          records may be retained for moderation. Use a note’s report button to
          flag it for review. For privacy questions or a removal request,
          contact the maintainer through{" "}
          <a href="https://aimatrixmap.com/contribute">
            the private AI Matrix Map contribution form
          </a>
          , choose “Correction,” and put “Bureau privacy request” in the company
          field. Include the note link when relevant. Avoid putting private
          details in public GitHub issues.
        </p>
      </article>
    </main>
  );
}
