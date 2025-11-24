const express = require("express");
const router = express.Router();

const userController = require("../controllers/userController");
const { loginRequired } = require("../middleware/authMiddleware");

/**
 * @openapi
 * /users/signup:
 *   post:
 *     summary: User signup
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, first_name, last_name, password, email]
 *             properties:
 *               username:
 *                 type: string
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               password:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 */
router.post("/signup", userController.signup);

/**
 * @openapi
 * /users/login:
 *   post:
 *     summary: User login
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User logged in successfully
 */
router.post("/login", userController.login);

/**
 * @openapi
 * /users/logout:
 *   post:
 *     summary: User logout
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post("/logout", loginRequired, (req, res) => {
  return res.json({ message: "Logout successful" });
});

/**
 * @openapi
 * /users:
 *   get:
 *     summary: Get list of users with optional filters
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: username
 *         schema:
 *           type: string
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *       - in: query
 *         name: first_name
 *         schema:
 *           type: string
 *       - in: query
 *         name: last_name
 *         schema:
 *           type: string
 *       - in: query
 *         name: is_admin
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/User"
 */
router.get("/", loginRequired, userController.getAllUsers);

/**
 * @openapi
 * /users/{user_id}:
 *   get:
 *     summary: Get a single user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/User"
 */
router.get("/:user_id", userController.getUserById);

/**
 * @openapi
 * /users/{user_id}:
 *   patch:
 *     summary: Update user info
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       description: Fields to update
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated user info
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/User"
 */
router.patch("/:user_id", loginRequired, userController.updateUser);

/**
 * @openapi
 * /users/{user_id}:
 *   delete:
 *     summary: Delete user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Successfully deleted user
 */
router.delete("/:user_id", loginRequired, userController.deleteUser);

module.exports = router;
