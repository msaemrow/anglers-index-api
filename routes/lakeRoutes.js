const express = require("express");
const router = express.Router();
const lakeController = require("../controllers/lakeController");
const {
  loginRequired,
  adminRequired,
} = require("../middleware/authMiddleware");

/**
 * @openapi
 * /lakes:
 *   get:
 *     summary: Get lakes filtered by various query parameters or get a specific lake by ID
 *     tags:
 *       - Lakes
 *     parameters:
 *       - in: query
 *         name: lake_id
 *         schema:
 *           type: integer
 *         description: Specific lake ID to retrieve (optional)
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: Filter lakes by state (optional)
 *       - in: query
 *         name: county
 *         schema:
 *           type: string
 *         description: Filter lakes by county (optional)
 *       - in: query
 *         name: nearest_town
 *         schema:
 *           type: string
 *         description: Filter lakes by nearest town (optional)
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter lakes by lake name (optional)
 *     responses:
 *       200:
 *         description: List of lakes or a single lake object
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: array
 *                   items:
 *                     $ref: '#/components/schemas/Lake'
 *                 - $ref: '#/components/schemas/Lake'
 *       404:
 *         description: Lake not found (if lake_id provided but no lake found)
 *       500:
 *         description: Server error
 */
router.get("/", lakeController.getLakes);

/**
 * @openapi
 * /lakes/{lakeId}:
 *   get:
 *     summary: Get a single lake by ID
 *     tags:
 *       - Lakes
 *     parameters:
 *       - in: path
 *         name: lakeId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the lake to retrieve
 *     responses:
 *       200:
 *         description: Lake retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Lake'
 *       404:
 *         description: Lake not found
 *       500:
 *         description: Server error
 */
router.get("/:lakeId", lakeController.getLakeById);

/**
 * @openapi
 * /lakes:
 *   post:
 *     summary: Add a new lake (admin only)
 *     tags:
 *       - Lakes
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Lake'
 *     responses:
 *       201:
 *         description: Lake created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Lake'
 *       400:
 *         description: Validation error or missing required fields
 *       500:
 *         description: Server error
 */
router.post("/", lakeController.addLake);

/**
 * @openapi
 * /lakes/{lakeId}:
 *   put:
 *     summary: Update a lake by ID (admin only)
 *     tags:
 *       - Lakes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lakeId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the lake to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Lake'
 *     responses:
 *       200:
 *         description: Lake updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Lake'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Lake not found
 *       500:
 *         description: Server error
 */
router.put("/:lakeId", adminRequired, lakeController.updateLake);

/**
 * @openapi
 * /lakes/{lakeId}:
 *   delete:
 *     summary: Delete a lake by ID (admin only)
 *     tags:
 *       - Lakes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lakeId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the lake to delete
 *     responses:
 *       200:
 *         description: Lake deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Lake deleted successfully"
 *       404:
 *         description: Lake not found
 *       500:
 *         description: Server error
 */
router.delete("/:lakeId", adminRequired, lakeController.deleteLake);

module.exports = router;
