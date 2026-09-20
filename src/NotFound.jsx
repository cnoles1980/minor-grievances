import React from "react";
import { ArrowLeft } from "@phosphor-icons/react";

export default function NotFound() {
  const home = import.meta.env.BASE_URL;
  return (
    <main className="missing-page">
      <a className="missing-brand" href={home}>
        <img
          src={`${home}assets/annoyed-note.png`}
          alt="An appropriately annoyed sticky note"
        />
        <span>
          THE BUREAU OF
          <br />
          MINOR GRIEVANCES
        </span>
      </a>
      <div className="missing-case">
        <span>CASE NO. 404</span>
        <span>DEPARTMENT OF INTERNET NONSENSE</span>
      </div>
      <article className="missing-note yellow" aria-labelledby="missing-title">
        <span className="stamp">OFFICIALLY MISSING</span>
        <p className="missing-label">A FORMALLY FILED GRIEVANCE ABOUT</p>
        <h1 id="missing-title">404 pages.</h1>
        <p className="missing-complaint">
          You click a perfectly good-looking link and suddenly finding the page
          is YOUR problem.
        </p>
        <p className="missing-signature">— Everyone, eventually.</p>
        <div className="missing-status">
          <span>STATUS: UNRESOLVED</span>
          <span>PATIENCE: ALSO MISSING</span>
        </div>
      </article>
      <p className="missing-explanation">
        This page could not be found.
        <br />
        Your irritation, however, has been officially noted.
      </p>
      <a className="file-button missing-return" href={home}>
        <ArrowLeft size={20} /> BACK TO THE GRIEVANCES
      </a>
      <p className="missing-footnote">
        THE BUREAU REGRETS THE INCONVENIENCE. MOSTLY.
      </p>
    </main>
  );
}
