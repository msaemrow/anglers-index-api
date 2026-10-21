require("dotenv").config();

function readAuthConfig(env = process.env) {
  const secret = env.JWT_SECRET_KEY;
  if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32 ||
      /your_default_secret_key|change.?me|replace.?me|your.?secret|example|placeholder/i.test(secret) ||
      new Set(secret).size < 8) {
    throw new Error("JWT_SECRET_KEY must be a randomly generated secret of at least 32 bytes; placeholders are not allowed.");
  }
  // This application uses symmetric signing only. Never select algorithms from token headers.
  if (env.JWT_ALGORITHM !== undefined && env.JWT_ALGORITHM !== "HS256") {
    throw new Error("JWT_ALGORITHM must be HS256.");
  }
  const expiration = env.JWT_EXPIRATION === undefined ? "86400" : env.JWT_EXPIRATION;
  if (!/^\d+$/.test(expiration) || !Number.isSafeInteger(Number(expiration)) ||
      Number(expiration) < 1 || Number(expiration) > 86400) {
    throw new Error("JWT_EXPIRATION must be a whole number of seconds between 1 and 86400.");
  }
  return Object.freeze({ secret, algorithm: "HS256", expiration: Number(expiration) });
}

module.exports = { readAuthConfig };
