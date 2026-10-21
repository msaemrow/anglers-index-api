// app.js

require("dotenv").config();
require("./helpers/authTokens"); // Fail before startup if authentication configuration is unsafe.
const express = require("express");
const cors = require("cors");
const app = express();
const { requestContext, errorHandler, publicError, logError } = require("./helpers/errors");
app.use(requestContext);
const { createRateLimiters, applyRouteLimits, readTrustedProxies } = require("./middleware/rateLimits");
app.set("trust proxy", readTrustedProxies());
const rateLimits = createRateLimiters();
const { swaggerSpec, swaggerUi } = require("./swagger/swaggerConfig");

// Import route modules
// const mainRoutes = require("./routes/mainRoutes");
const userRoutes = require("./routes/userRoutes");
const fishCatchRoutes = require("./routes/fishCatchRoutes");
const lureRoutes = require("./routes/lureRoutes");
const lakeRoutes = require("./routes/lakeRoutes");
const fishSpeciesRoutes = require("./routes/speciesRoutes");
const masterAnglerRoutes = require("./routes/masterAnglerRoutes");
const tackleBoxRoutes = require("./routes/tackleBoxRoutes");

// Import your DB connection setup
const { connectDb } = require("./models"); // Assuming models/index.js exports this

// Setup CORS
const allowedOrigins = [
  "http://localhost:3000",
  "http://192.168.4.24:8082",
  "https://anglers-index.vercel.app",
  "https://anglersindex.com",
  "https://www.anglersindex.com",
];
app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin like mobile apps or curl
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        return callback(publicError(403, "Origin is not allowed."), false);
      }
      return callback(null, true);
    },
  }),
);

// Limit before parsing bodies or performing database/external work.
app.use(rateLimits.api);
app.use(express.json());
applyRouteLimits(app, rateLimits);

// Use swagger docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// expose swagger JSON for Postman
app.get("/swagger.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// The dashboard is scoped to the authenticated user, never a query-string user ID.
const { addUserToReq, loginRequired } = require("./middleware/authMiddleware");
const { getDashboard } = require("./controllers/dashboardController");
app.get("/dashboard", addUserToReq, loginRequired, getDashboard);

// Register routes with their paths
// app.use("/", mainRoutes);
app.use("/users", userRoutes);
app.use("/fishcatch", fishCatchRoutes);
app.use("/lures", lureRoutes);
app.use("/lakes", lakeRoutes);
app.use("/species", fishSpeciesRoutes);
app.use("/masterangler", masterAnglerRoutes);
app.use("/tackle-box", tackleBoxRoutes);
app.use("/trips", require("./routes/tripRoutes"));

// Basic routes
app.get("/", (req, res) => {
  res.json({ message: "Welcome to Anglers Index!" });
});

app.get("/test", (req, res) => {
  res.json({ message: "Test route" });
});

app.use((req, res) => res.status(404).json({ error: "Route not found." }));
app.use(errorHandler);

// Start server after connecting to DB
const PORT = process.env.PORT || 5000;

connectDb()
  .then(() => {
    console.log("Successfully connected to DB");
    app.listen(PORT, () => {
      console.log(`Server started on port ${PORT}`);
    });
  })
  .catch((err) => {
    logError(err, undefined, "database_startup");
  });
