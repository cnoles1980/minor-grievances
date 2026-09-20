import { copyFileSync, writeFileSync } from "node:fs";
// GitHub serves this entry with HTTP 404, while the app renders the grievance.
copyFileSync("dist/client/index.html", "dist/client/404.html");
writeFileSync("dist/client/.nojekyll", "");
