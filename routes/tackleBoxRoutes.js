const express = require("express");
const router = express.Router();

const tackleBoxController = require("../controllers/tackleBoxController");
const { loginRequired } = require("../middleware/authMiddleware"); // if you have auth middleware

router.post("/", loginRequired, tackleBoxController.toggleFavorite);

router.get("/:user_id", loginRequired, tackleBoxController.getTackleBoxLures);

module.exports = router;
