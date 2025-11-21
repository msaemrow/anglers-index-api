// routes/fishCatchRoutes.js

const express = require("express");
const router = express.Router();
const fishCatchController = require("../controllers/fishCatchController");

// Read all for user
router.get("/", fishCatchController.getFishCatches);

// Create
router.post("/", fishCatchController.addFishCatch);

// Delete
router.delete("/:catch_id", fishCatchController.deleteFishCatch);

// Update master angler
router.put(
  "/:catch_id/master-angler",
  fishCatchController.updateMasterAnglerStatus
);

// Weather
router.post("/weather", fishCatchController.getWeather);

module.exports = router;
