const express = require("express");
const router = express.Router();

const fishSpeciesController = require("../controllers/speciesController");
const { adminRequired } = require("../middleware/authMiddleware"); // Assuming you have adminRequired middleware

router.get("/all", fishSpeciesController.getAllFishSpecies);

router.post("/", adminRequired, fishSpeciesController.addFishSpecies);

router.put(
  "/:speciesId",
  adminRequired,
  fishSpeciesController.updateFishSpecies
);

router.delete(
  "/:speciesId",
  adminRequired,
  fishSpeciesController.deleteFishSpecies
);

module.exports = router;
