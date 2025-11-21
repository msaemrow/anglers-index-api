const express = require("express");
const router = express.Router();

const {
  getAllUserLures,
  getAllLures,
  getBrandNames,
  addLure,
  editLure,
  deleteLure,
} = require("../controllers/lureController");

const {
  loginRequired,
  adminRequired,
  tokenRequired,
} = require("../middleware/authMiddleware");
// Adjust middleware import to your setup

// Routes
router.get("/all/:userId", getAllUserLures);
router.get("/all", getAllLures);
router.get("/brands", getBrandNames);
router.post("/", tokenRequired, addLure);
router.put("/edit/:lureId", adminRequired, editLure);
router.delete("/delete/:lureId", loginRequired, deleteLure);

module.exports = router;
