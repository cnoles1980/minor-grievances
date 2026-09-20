export function validateProductionConfig(env) {
  if (env.NODE_ENV !== "production") return;
  for (const key of ["ADMIN_TOKEN", "RATE_LIMIT_SECRET"]) {
    if (
      typeof env[key] !== "string" ||
      env[key].length < 43 ||
      /\s/.test(env[key])
    ) {
      throw new Error(
        `${key} must be a randomly generated secret of at least 43 characters.`,
      );
    }
  }
  if (env.ADMIN_TOKEN === env.RATE_LIMIT_SECRET)
    throw new Error(
      "Use separate secrets for administration and anonymous identity hashing.",
    );
  let origin;
  try {
    origin = new URL(env.ALLOWED_ORIGIN);
  } catch {
    throw new Error("Set ALLOWED_ORIGIN to the exact HTTPS frontend origin.");
  }
  if (origin.protocol !== "https:" || origin.origin !== env.ALLOWED_ORIGIN)
    throw new Error(
      "ALLOWED_ORIGIN must be an HTTPS origin without a path, credentials, query, or trailing slash.",
    );
  if (env.SEED_DEMO === "1")
    throw new Error("Production must not seed illustrative endorsements.");
}
