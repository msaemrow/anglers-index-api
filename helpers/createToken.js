const { signToken } = require("./authTokens");

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

  return signToken(payload);
}

module.exports = createToken;
