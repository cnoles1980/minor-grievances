# The Bureau of Minor Grievances

A deliberately over-serious home for everyday irritation. Faithfully based on the selected **Controlled Chaos** reference, with the annoyed yellow sticky-note mascot added to the masthead.

## What works

- Anonymous 3–240-character grievances, optional signatures, four paper colors, seven categories.
- Shared SQLite persistence, one endorsement per anonymous browser ID, server-side search and filtering.
- Endless vertical scrolling with 80-note cursor pagination, random discovery across the database, and direct complaint links.
- Keyboard-accessible native filing dialog, mobile layout, zoom controls, reduced-motion support.
- Reports, protected moderation endpoints, input validation, parameterized SQL, request-size limits, origin allowlisting, and IP-based write limits.

## Run locally

Requires Node.js 24 or newer. From this folder:

```powershell
npm ci
npm run dev -- --port 4173 --strictPort
```

Open http://127.0.0.1:4173/. The development command starts the frontend and API together. The API is on 127.0.0.1:4317. A new development database gets illustrative complaints and counts. User-created notes start at zero. The footer discloses the sample content. Saved data lives in `data/bureau.sqlite` and is ignored by Git.

The local preview was launched during the build; no setup is needed while it remains running.

## Verification

```powershell
npm test
npm run build
npm run test:sites
npm audit
```

API tests cover persistence, duplicate endorsements, multiple anonymous visitors, validation, SQL-like input, denied origins, limits, reports, moderator authentication, hide/restore, pagination during concurrent insertions, filters, and direct links. `design-qa.md` records browser verification.

## GitHub Pages + API deployment

GitHub Pages hosts the frontend only. A Node host with a persistent volume must run the API. Do not publish just the static build and expect shared posting to work.

1. Deploy this repository to a Node 24 host with a persistent disk. Install with `npm ci`, build with `npm run build`, start with `npm start`. Set `NODE_ENV=production`, `HOST=0.0.0.0`, the host-provided `PORT`, and `DB_PATH` to the mounted disk (for example `/data/bureau.sqlite`). Use a **fresh production database**, not the seeded preview database.
2. In the host's secret settings, create separate random values of at least 32 bytes for `ADMIN_TOKEN` and `RATE_LIMIT_SECRET`. Keep the rate-limit secret stable: it also hashes anonymous visitor IDs used for endorsement deduplication. Do not put either secret in frontend variables, GitHub source, or browser code.
3. Set `ALLOWED_ORIGIN=https://YOURNAME.github.io` (origin only, no repository path). Enable HTTPS for the API. The server refuses production startup without the three required settings.
4. For the frontend build, set `VITE_API_URL=https://YOUR-API-HOST` and `VITE_BASE_PATH=/YOUR-REPOSITORY/`. If serving from a custom domain root, use `/`. Run `npm run build` and publish **dist/client** with GitHub Pages. Only the two `VITE_` variables are public.
5. Before sharing publicly, verify from two separate browsers that posting and endorsements are shared, duplicate endorsements are blocked, and reports appear in moderation. Establish a reporting review routine, database backups, and an edge rate limit/bot challenge appropriate to the host.

The API can also serve the built frontend from the same Node host. In that case leave `VITE_API_URL` empty, use root base `/`, and set `ALLOWED_ORIGIN` to that host's HTTPS origin. No accounts or third-party services were created, and nothing has been published.

### Deployment limits

This is a working prototype, not a hardened high-traffic community service. Anonymous browser IDs can be reset by clearing storage. IP limits do not prove a unique human. Proxy trust is deliberately disabled; behind a reverse proxy, configure the **specific trusted proxy** before relying on per-IP limits, or unrelated users may share one limit. Never blindly trust arbitrary forwarded headers. Add edge protection and consider a privacy notice before a public launch. Reports do not automatically remove notes; a moderator must review them. SQLite uses one persistent server instance; horizontal scaling needs a different storage/coordination approach. Back up the database using SQLite-aware backups, including WAL handling. Browser testing here covers desktop and simulated mobile viewport, not a physical phone keyboard.

## Moderation

Use the provided helper from a trusted terminal with `ADMIN_TOKEN` and `BUREAU_API_URL` set in that terminal environment:

```powershell
node scripts/moderate.mjs list
node scripts/moderate.mjs hide COMPLAINT_ID
node scripts/moderate.mjs restore COMPLAINT_ID
```

`hide` is reversible. The helper never prints the secret. For local moderation, restart the development server with the same `ADMIN_TOKEN` set. Never expose the token in a `VITE_` variable.

## Structure and assets

- `src/App.jsx`: wall, filtering, pagination, note actions, filing dialog.
- `src/styles.css`: responsive art direction and reference-fidelity refinements.
- `src/api.js`: API client and anonymous browser identity.
- `server/app.js`: Express/SQLite API and moderation.
- `server/start.js`: environment validation and persistent development hashing secret.
- `public/assets/annoyed-note.png`: generated transparent mascot.
- `public/assets/grid.png`: generated ivory graph-paper texture.
- `evidence/`: comparison and responsive screenshots.

Fonts are self-hosted open-source Anton, Patrick Hand, Barlow Condensed, and Caveat via Fontsource; icons are Phosphor. No analytics or AI API calls occur when people use the site.

The two raster assets were created with built-in imagegen. Mascot prompt: “Faithfully recreate the reference’s bottom-center annoyed sticky-note mascot as a centered standalone transparent logo, yellow textured paper, black unimpressed face, folded lower-right corner, no wordmark, readable at 80px.” Texture prompt: “Seamless opaque ivory graph paper, understated thin gray-beige 12-by-12 grid, flat frontal view, no text, shadows, folds, or objects.”

## Sorting and launch review update

The front page defaults to Recent (new to old) on a fresh load. Old to new, Most +1s, and Least +1s apply server-side across the database, search, and category filters. Pagination uses created/id tie-breakers and vote-aware cursors. Posting a new grievance returns to Recent so the new note is easy to find. Rankings can shift as other people endorse notes; refresh to get current ordering.

Production startup now requires independently generated ADMIN_TOKEN and RATE_LIMIT_SECRET values of at least 43 characters and an exact HTTPS ALLOWED_ORIGIN. Generate at least 32 random bytes per secret (64 hex characters); store them in your host's secret manager. Read security-review.md before public deployment for the remaining host, moderation, and backup requirements.

## Published preview and GA4

GitHub Actions publishes `dist/client` to GitHub Pages. If the repository variable `BUREAU_API_URL` is unset, it builds an explicitly read-only public preview using illustrative notes. Filing, endorsements, and reporting are disabled. Set the variable to the HTTPS API endpoint and rerun the workflow to enable the shared wall.

Set repository variable `BUREAU_GA4_ID` to your GA4 measurement ID (`G-...`) and rerun the Pages workflow to enable optional analytics. Until an ID is configured, no Google tag loads. The consent control defaults to no tracking; Google Analytics loads only after the visitor chooses Allow. Page URLs are normalized (no search strings, note IDs, or arbitrary missing-page paths), and complaint text/signatures are never sent. Only page views and the fixed events grievance_filed, grievance_endorsed, and sort_changed are explicitly tracked. Disable enhanced measurement's form interactions/site search in the GA4 stream if those automatic features are not wanted. Verify the installation in GA4 Realtime after granting consent. Rejection leaves the site fully usable.

Unknown URLs render Complaint #404: a formally filed grievance about 404 pages. GitHub Pages returns the correct HTTP 404 response while the custom page loads the site's assets from its configured repository base path.
