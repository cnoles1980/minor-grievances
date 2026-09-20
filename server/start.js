import { validateProductionConfig } from "./config.js";
import { createApp } from "./app.js";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const production = process.env.NODE_ENV === "production";
validateProductionConfig(process.env);
if (!production && !process.env.RATE_LIMIT_SECRET) {
  mkdirSync("data", { recursive: true });
  const path = "data/dev-secret";
  if (!existsSync(path))
    writeFileSync(path, randomBytes(32).toString("hex"), { mode: 0o600 });
  process.env.RATE_LIMIT_SECRET = readFileSync(path, "utf8").trim();
}
const { app } = createApp({
  demo: process.env.SEED_DEMO === "1",
  dbPath: process.env.DB_PATH || "data/bureau.sqlite",
});
app.listen(
  Number(process.env.PORT || 4317),
  process.env.HOST || "127.0.0.1",
  () => console.log("Bureau API listening."),
);
