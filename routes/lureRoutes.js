const express = require("express");
const router = express.Router();

const {
  getLures,
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
router.get("/", getLures);
router.post("/", tokenRequired, addLure);
router.put("/edit/:lureId", adminRequired, editLure);
router.delete("/delete/:lureId", loginRequired, deleteLure);

module.exports = router;
