const jwt = require("jsonwebtoken");

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "your_default_secret_key";
const JWT_ALGORITHM = process.env.JWT_ALGORITHM || "HS256";
const JWT_EXPIRATION = parseInt(process.env.JWT_EXPIRATION, 10) || 86400; // seconds

function createToken(user) {
  const payload = {
    user_id: user.id,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    master_angler_catches: user.masterAnglerCatches, // make sure this matches your JS naming
    fish_catches: user.fishCatches,
    is_admin: user.is_admin,
  };

  // jwt.sign automatically adds 'iat' (issued at)
  // 'exp' must be a UNIX timestamp in seconds, so calculate current time + expiration
  const options = {
    algorithm: JWT_ALGORITHM,
    expiresIn: JWT_EXPIRATION, // this accepts seconds or string like '1d'
  };

  const token = jwt.sign(payload, JWT_SECRET_KEY, options);

  return token;
}

module.exports = createToken;
