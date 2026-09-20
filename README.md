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

API tests cover persistence, duplicate endorsements, multiple anonymous visitors, validation, SQL-like input, denied origins, limits, reports, moderator authentication, hide/restore, pagination during concurrent insertions, filters, and direct links. Browser checks cover the published home and custom 404.

## Public deployment

Live site: https://cnoles1980.github.io/minor-grievances/

GitHub Pages serves the frontend; Cloudflare Worker minor-grievances-api handles shared posts and endorsements, backed by the separate minor-grievances D1 database. Production starts empty; local illustrative notes and user data are not copied. Staticbreaker is unaffected.

Frontend pushes to main deploy automatically. Repository variables BUREAU_API_URL and BUREAU_GA4_ID configure the public API URL and optional analytics ID. Backend changes require npm ci, npx wrangler d1 migrations apply minor-grievances --remote, then npx wrangler deploy. Review migrations before applying to existing data.

ADMIN_TOKEN and RATE_LIMIT_SECRET are independent random secrets stored in Cloudflare Worker secrets. Keep RATE_LIMIT_SECRET stable for endorsement deduplication. An ignored local cloudflare-secrets.json holds the initial recovery copy; keep it private and back it up in your password manager. Never put secrets in VITE_ variables or Git. Wrangler authorization is encrypted using Windows Credential Manager.

### Operating limits

This is a small public beta with server-side validation, parameterized SQL, atomic endorsement counting, protected moderation, and IP limits. Anonymous browser IDs can be reset and IP limits do not establish unique humans. Distributed spam can still consume service quotas; monitor Cloudflare usage and add a bot challenge if needed. No paid plan upgrade was made. Reports require human review; they do not automatically hide notes. Review reports regularly and export D1 backups before schema changes. The local Node server is for development; its proxy settings do not govern the Cloudflare deployment.

## Moderation

Use the provided helper from a trusted terminal with ADMIN_TOKEN and BUREAU_API_URL set. For this checkout, load the ignored recovery file without printing its contents:

```powershell
$env:ADMIN_TOKEN = (Get-Content cloudflare-secrets.json -Raw | ConvertFrom-Json).ADMIN_TOKEN
$env:BUREAU_API_URL = "https://minor-grievances-api.cnoles1980.workers.dev"
```

Then review reports or reversibly hide/restore a complaint:

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

Fonts are self-hosted open-source Anton, Patrick Hand, Barlow Condensed, and Caveat via Fontsource; icons are Phosphor. Google Analytics is optional and consent-gated. No AI API calls occur when people use the site.

The two raster assets were created with built-in imagegen. Mascot prompt: “Faithfully recreate the reference’s bottom-center annoyed sticky-note mascot as a centered standalone transparent logo, yellow textured paper, black unimpressed face, folded lower-right corner, no wordmark, readable at 80px.” Texture prompt: “Seamless opaque ivory graph paper, understated thin gray-beige 12-by-12 grid, flat frontal view, no text, shadows, folds, or objects.”

## Sorting and launch review update

The front page defaults to Recent (new to old) on a fresh load. Old to new, Most +1s, and Least +1s apply server-side across the database, search, and category filters. Pagination uses created/id tie-breakers and vote-aware cursors. Posting a new grievance returns to Recent so the new note is easy to find. Rankings can shift as other people endorse notes; refresh to get current ordering.

Production startup now requires independently generated ADMIN_TOKEN and RATE_LIMIT_SECRET values of at least 43 characters and an exact HTTPS ALLOWED_ORIGIN. Generate at least 32 random bytes per secret (64 hex characters); store them in your host's secret manager. The Cloudflare deployment uses Worker secrets for these values.

## GitHub Pages and GA4

GitHub Actions publishes `dist/client` to GitHub Pages. If the repository variable `BUREAU_API_URL` is unset, it builds an explicitly read-only public preview using illustrative notes. Filing, endorsements, and reporting are disabled. Set the variable to the HTTPS API endpoint and rerun the workflow to enable the shared wall.

Set repository variable `BUREAU_GA4_ID` to your GA4 measurement ID (`G-...`) and rerun the Pages workflow to enable optional analytics. Until an ID is configured, no Google tag loads. The consent control defaults to no tracking; Google Analytics loads only after the visitor chooses Allow. Page URLs are normalized (no search strings, note IDs, or arbitrary missing-page paths), and complaint text/signatures are never sent. Only page views and the fixed events grievance_filed, grievance_endorsed, and sort_changed are explicitly tracked. Disable enhanced measurement's form interactions/site search in the GA4 stream if those automatic features are not wanted. Verify the installation in GA4 Realtime after granting consent. Rejection leaves the site fully usable.

Unknown URLs render Complaint #404: a formally filed grievance about 404 pages. GitHub Pages returns the correct HTTP 404 response while the custom page loads the site's assets from its configured repository base path.
