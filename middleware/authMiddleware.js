const { logError } = require("../helpers/errors");
// middleware/authMiddleware.js

const { verifyToken } = require("../helpers/authTokens");
const { User, RevokedSession } = require("../models");

// Middleware to add user to req.user if JWT is valid
async function addUserToReq(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    req.user = null;
    return next();
  }

  const token = typeof authHeader === "string" ? /^Bearer ([^\s]+)$/i.exec(authHeader)?.[1] : null;
  if (!token) {
    req.user = null;
    return next();
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    req.user = null;
    return next();
  }

  try {
    const revoked = await RevokedSession.findByPk(decoded.jti);
    if (revoked) {
      req.user = null;
      return next();
    }
    req.user = await User.findByPk(decoded.user_id) || null;
    if (req.user) req.session = { id: decoded.jti, expiresAt: new Date(decoded.exp * 1000) };
  } catch (error) {
    logError(error, req, "authenticate");
    // Do not treat revocation-store failures as successful authentication.
    return res.status(503).json({ error: "Authentication is temporarily unavailable. Please try again." });
  }

  next();
}

// Middleware to require login (user must be authenticated)
function loginRequired(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized. Must be logged in." });
  }
  next();
}

// Middleware to require admin user
function adminRequired(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: "Unauthorized. Must be an admin." });
  }
  next();
}

// Retain the legacy export, but require a verified token AND an existing user.
async function tokenRequired(req, res, next) {
  return addUserToReq(req, res, () => loginRequired(req, res, next));
}

module.exports = {
  addUserToReq,
  loginRequired,
  adminRequired,
  tokenRequired,
};
