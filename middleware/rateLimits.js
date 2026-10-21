const { rateLimit } = require("express-rate-limit");
const { createHash } = require("node:crypto");
const { isIP } = require("node:net");

function readTrustedProxies(env = process.env) {
  if (!env.TRUSTED_PROXIES?.trim()) return false;
  const proxies = env.TRUSTED_PROXIES.split(",").map((value) => value.trim());
  for (const proxy of proxies) {
    if (proxy === "loopback") continue;
    const [address, prefix, extra] = proxy.split("/");
    const version = isIP(address);
    if (
      !version ||
      extra !== undefined ||
      (prefix !== undefined &&
        (!/^\d+$/.test(prefix) ||
          Number(prefix) < 1 ||
          Number(prefix) > (version === 4 ? 32 : 128)))
    ) {
      throw Error(
        "TRUSTED_PROXIES must contain explicit proxy IPs/CIDRs or loopback, never a blanket trust setting.",
      );
    }
  }
  return proxies;
}

// Memory stores are per process: use one API instance until a shared store is configured.
function createRateLimiters(overrides = {}) {
  function limiter(name, windowMs, limit, extra = {}) {
    return rateLimit({
      windowMs,
      limit,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      identifier: name,
      message: { error: "Too many requests. Please try again later." },
      ...extra,
      ...overrides[name],
    });
  }
  return {
    api: limiter("api", 5 * 60 * 1000, 600, {
      skip: (req) => req.method === "OPTIONS",
    }),
    loginIp: limiter("login-ip", 15 * 60 * 1000, 30),
    loginAccount: limiter("login-account", 15 * 60 * 1000, 5, {
      skipSuccessfulRequests: true,
      keyGenerator: (req) =>
        createHash("sha256")
          .update(
            typeof req.body?.username === "string"
              ? req.body.username.trim().toLowerCase()
              : "invalid-username",
          )
          .digest("hex"),
    }),
    signup: limiter("signup", 60 * 60 * 1000, 3),
    upload: limiter("upload", 15 * 60 * 1000, 30),
    weather: limiter("weather", 60 * 1000, 15),
  };
}

function applyRouteLimits(app, limits) {
  app.post("/users/login", limits.loginIp, limits.loginAccount);
  app.post("/users/signup", limits.signup);
  // Includes catch creation because it can process a photo and fetch weather.
  app.post(["/fishcatch", "/fishcatch/:catch_id/photo"], limits.upload);
  app.post("/fishcatch/weather", limits.weather);
  app.post("/lakes", limits.weather);
  app.put("/lakes/:lakeId", limits.weather);
}

module.exports = { createRateLimiters, applyRouteLimits, readTrustedProxies };
