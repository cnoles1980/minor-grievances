import test from "node:test";
import assert from "node:assert/strict";
import { validateProductionConfig } from "../server/config.js";
const valid = {
  NODE_ENV: "production",
  ADMIN_TOKEN: "a".repeat(64),
  RATE_LIMIT_SECRET: "b".repeat(64),
  ALLOWED_ORIGIN: "https://example.com",
};
test("production startup rejects weak secrets and insecure or malformed deployment settings", () => {
  assert.doesNotThrow(() => validateProductionConfig(valid));
  for (const change of [
    { ADMIN_TOKEN: "password" },
    { RATE_LIMIT_SECRET: undefined },
    { RATE_LIMIT_SECRET: valid.ADMIN_TOKEN },
    { ALLOWED_ORIGIN: "http://example.com" },
    { ALLOWED_ORIGIN: "https://example.com/path" },
    { ALLOWED_ORIGIN: "https://example.com/" },
    { SEED_DEMO: "1" },
  ])
    assert.throws(() => validateProductionConfig({ ...valid, ...change }));
  assert.doesNotThrow(() =>
    validateProductionConfig({ NODE_ENV: "development" }),
  );
});
