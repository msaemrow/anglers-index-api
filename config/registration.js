// Only an explicit server-side opt-in opens public account creation.
function isSignupEnabled(env = process.env) {
  return env.ALLOW_PUBLIC_SIGNUP === "true";
}

module.exports = { isSignupEnabled };
