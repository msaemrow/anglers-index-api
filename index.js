// app.js

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();

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

// Middleware
app.use(express.json()); // to parse JSON request bodies

// Setup CORS
const allowedOrigins = [
  "http://localhost:3000",
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
        const msg =
          "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
  })
);

// Register routes with their paths
// app.use("/", mainRoutes);
app.use("/users", userRoutes);
app.use("/fishcatch", fishCatchRoutes);
app.use("/lures", lureRoutes);
app.use("/lakes", lakeRoutes);
app.use("/species", fishSpeciesRoutes);
app.use("/masterangler", masterAnglerRoutes);
app.use("/tacklebox", tackleBoxRoutes);

// Basic routes
app.get("/", (req, res) => {
  res.json({ message: "Welcome to Anglers Index!" });
});

app.get("/test", (req, res) => {
  res.json({ message: "Test route" });
});

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
    console.error("Failed to connect to DB", err);
  });
