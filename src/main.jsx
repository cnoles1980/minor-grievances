import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import AnalyticsConsent from "./AnalyticsConsent.jsx";
import NotFound from "./NotFound.jsx";
import "./styles.css";
const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const pathname = window.location.pathname;
const isHome = [`${base}/`, `${base}/index.html`, base || "/"].includes(
  pathname,
);
if (!isHome) document.title = "Complaint #404 — The Bureau of Minor Grievances";
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isHome ? <App /> : <NotFound />}
    <AnalyticsConsent />
  </React.StrictMode>,
);
