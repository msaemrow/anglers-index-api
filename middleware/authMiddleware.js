// middleware/authMiddleware.js

const jwt = require("jsonwebtoken");
const { User } = require("../models");
require("dotenv").config();

const SECRET_KEY = process.env.JWT_SECRET_KEY;

// Middleware to add user to req.user if JWT is valid
async function addUserToReq(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(" ")[1]; // Bearer <token>
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await User.findByPk(decoded.user_id);
    req.user = user || null;
  } catch (err) {
    req.user = null;
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
    return res.status(401).json({ error: "Unauthorized. Must be an admin." });
  }
  next();
}

// Middleware that checks for valid token (like token_required)
// and adds user to req.user (calls next or returns error)
function tokenRequired(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ error: "Token is missing" });
  }

  const token = authHeader.split(" ")[1]; // Bearer <token>
  if (!token) {
    return res.status(401).json({ error: "Token is missing" });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = { id: decoded.user_id }; // minimal info, or fetch user in separate middleware
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired" });
    } else {
      return res.status(401).json({ error: "Invalid token" });
    }
  }
}

module.exports = {
  addUserToReq,
  loginRequired,
  adminRequired,
  tokenRequired,
};
