import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Privacy from "./Privacy.jsx";
import { startAnalytics } from "./analytics";
import NotFound from "./NotFound.jsx";
import "./styles.css";
const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const pathname = window.location.pathname;
const isHome = [`${base}/`, `${base}/index.html`, base || "/"].includes(
  pathname,
);
const isPrivacy = [
  `${base}/privacy`,
  `${base}/privacy/`,
  `${base}/privacy/index.html`,
].includes(pathname);
if (isPrivacy) document.title = "Privacy — The Bureau of Minor Grievances";
else if (!isHome)
  document.title = "Complaint #404 — The Bureau of Minor Grievances";
startAnalytics();
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isHome ? <App /> : isPrivacy ? <Privacy /> : <NotFound />}
    {!isPrivacy && (
      <a className="analytics-settings privacy-link" href={`${base}/privacy/`}>
        Privacy & analytics
      </a>
    )}
  </React.StrictMode>,
);
