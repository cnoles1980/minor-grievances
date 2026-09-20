import React, { useEffect, useState } from "react";
import {
  analyticsAvailable,
  analyticsChoice,
  setAnalyticsChoice,
} from "./analytics";
export default function AnalyticsConsent() {
  const [open, setOpen] = useState(analyticsAvailable && !analyticsChoice());
  useEffect(() => {
    if (analyticsAvailable && analyticsChoice() === "allow")
      setAnalyticsChoice("allow");
  }, []);
  if (!analyticsAvailable) return null;
  const choose = (value) => {
    setAnalyticsChoice(value);
    setOpen(false);
  };
  return (
    <aside className="analytics-consent" aria-label="Analytics preferences">
      {open ? (
        <div className="analytics-panel">
          <p>
            <strong>A little less pointless paperwork?</strong>
            <br />
            Allow optional Google Analytics to count visits and basic actions?
            Complaint text and signatures are never sent. Your choice won’t
            affect the wall.
          </p>
          <div>
            <button onClick={() => choose("deny")}>No thanks</button>
            <button onClick={() => choose("allow")}>Allow analytics</button>
          </div>
        </div>
      ) : (
        <button className="analytics-settings" onClick={() => setOpen(true)}>
          Analytics preferences
        </button>
      )}
    </aside>
  );
}
