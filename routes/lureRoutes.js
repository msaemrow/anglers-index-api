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

/**
 * @openapi
 * /lures:
 *   get:
 *     summary: Get lures and/or brands with optional filters
 *     tags:
 *       - Lures
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *         description: Filter lures owned by the user ID
 *       - in: query
 *         name: brand
 *         schema:
 *           type: string
 *         description: Filter lures by brand name (partial match)
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter lures by lure name (partial match)
 *       - in: query
 *         name: color
 *         schema:
 *           type: string
 *         description: Filter lures by color (partial match)
 *       - in: query
 *         name: brands_only
 *         schema:
 *           type: string
 *           enum: ["Y"]
 *         description: If "Y", return only distinct brands (no lure objects)
 *       - in: query
 *         name: lures_only
 *         schema:
 *           type: string
 *           enum: ["Y"]
 *         description: If "Y", return only the array of lure objects (no brands)
 *     responses:
 *       200:
 *         description: List of lures and/or brands
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: array
 *                   items:
 *                     type: string
 *                   description: Array of brand names (if brands_only=Y)
 *                 - type: array
 *                   items:
 *                     $ref: '#/components/schemas/Lure'
 *                   description: Array of lure objects (if lures_only=Y)
 *                 - type: object
 *                   properties:
 *                     lures:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Lure'
 *                     brands:
 *                       type: array
 *                       items:
 *                         type: string
 */
router.get("/", getLures);

/**
 * @openapi
 * /lures:
 *   post:
 *     summary: Add a new lure
 *     tags:
 *       - Lures
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Lure'
 *     responses:
 *       201:
 *         description: Lure created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Lure'
 *       400:
 *         description: Missing required fields or lure already exists
 *       500:
 *         description: Server error
 */
router.post("/", addLure);

/**
 * @openapi
 * /lures/edit/{lureId}:
 *   put:
 *     summary: Edit a lure by ID
 *     tags:
 *       - Lures
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lureId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the lure to edit
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               brand:
 *                 type: string
 *               name:
 *                 type: string
 *               color:
 *                 type: string
 *               size:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lure updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Lure'
 *       404:
 *         description: Lure not found
 *       500:
 *         description: Server error
 */
router.put("/:lureId", editLure);

/**
 * @openapi
 * /lures/delete/{lureId}:
 *   delete:
 *     summary: Delete a lure by ID
 *     tags:
 *       - Lures
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lureId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the lure to delete
 *     responses:
 *       200:
 *         description: Lure deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Lure deleted successfully"
 *       404:
 *         description: Lure not found
 *       500:
 *         description: Server error
 */
router.delete("/delete/:lureId", deleteLure);

module.exports = router;
