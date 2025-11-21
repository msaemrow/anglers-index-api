const express = require("express");
const router = express.Router();

const userController = require("../controllers/userController");
const { loginRequired } = require("../middleware/authMiddleware"); // Your auth middleware to verify JWT & set req.user

router.post("/signup", userController.signup);
router.post("/login", userController.login);
router.post("/logout", loginRequired, (req, res) => {
  // Just clear token on client side; server is stateless with JWT
  return res.json({ message: "Logout successful" });
});

router.get("/all", loginRequired, userController.getAllUsers);
router.get("/:user_id", loginRequired, userController.getUserById);
router.patch("/:user_id", loginRequired, userController.updateUser);
router.delete("/:user_id", loginRequired, userController.deleteUser);

module.exports = router;
