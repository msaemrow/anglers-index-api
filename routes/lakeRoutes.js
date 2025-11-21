// routes/lakeRoutes.js

const express = require("express");
const router = express.Router();
const lakeController = require("../controllers/lakeController");
const {
  loginRequired,
  adminRequired,
} = require("../middleware/authMiddleware");

// Get all lakes - public route
router.get("/", lakeController.getLakes);

// Get lake details by ID - requires login

// Add a new lake - admin only
router.post("/", adminRequired, lakeController.addLake);

// Update a lake by ID - admin only
router.put("/:lakeId", adminRequired, lakeController.updateLake);

// Delete a lake by ID - admin only
router.delete("/:lakeId", adminRequired, lakeController.deleteLake);

module.exports = router;
