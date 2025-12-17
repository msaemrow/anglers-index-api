const express = require("express");
const router = express.Router();

const tackleBoxController = require("../controllers/tackleBoxController");
const { loginRequired } = require("../middleware/authMiddleware");

/**
 * @openapi
 * /tackle-box/{user_id}:
 *   get:
 *     summary: Get all lures in a user's tackle box
 *     tags: [Tackle Box]
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of favorite lures
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tackle_box:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Lure'
 *       404:
 *         description: No lures found for user
 */
router.get("/:user_id", tackleBoxController.getTackleBoxLures);

/**
 * @openapi
 * /tackle-box:
 *   post:
 *     summary: Add a lure to user's favorites
 *     tags: [Tackle Box]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id, lure_id]
 *             properties:
 *               user_id:
 *                 type: integer
 *               lure_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Lure added to favorites
 *       409:
 *         description: Lure already in favorites
 *       400:
 *         description: Missing required fields
 */
router.post("/", tackleBoxController.addFavorite);

/**
 * @openapi
 * /tackle-box:
 *   delete:
 *     summary: Remove a lure from user's favorites (soft delete)
 *     tags: [Tackle Box]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id, lure_id]
 *             properties:
 *               user_id:
 *                 type: integer
 *               lure_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Lure removed from favorites
 *       404:
 *         description: Favorite not found
 *       400:
 *         description: Missing required fields
 */
router.delete("/", tackleBoxController.removeFavorite);

module.exports = router;
