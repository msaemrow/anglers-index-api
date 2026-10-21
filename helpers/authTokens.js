const { randomUUID } = require("node:crypto");
const jwt = require("jsonwebtoken");
const { readAuthConfig } = require("../config/auth");

// Validate once when the application loads, before connecting to the database or listening.
const config = readAuthConfig();

function signToken(payload) {
  return jwt.sign(payload, config.secret, { algorithm: config.algorithm, expiresIn: config.expiration, jwtid: randomUUID() });
}

function verifyToken(token) {
  const payload = jwt.verify(token, config.secret, {
    algorithms: [config.algorithm],
    maxAge: config.expiration,
  });
  if (!payload || typeof payload !== "object" ||
      typeof payload.jti !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.jti) || !Number.isSafeInteger(payload.user_id) || payload.user_id <= 0 ||
      !Number.isSafeInteger(payload.exp) || !Number.isSafeInteger(payload.iat) ||
      payload.exp <= payload.iat || payload.exp - payload.iat > config.expiration ||
      payload.iat > Math.floor(Date.now() / 1000)) {
    throw new Error("Invalid token claims");
  }
  return payload;
}

module.exports = { signToken, verifyToken };
