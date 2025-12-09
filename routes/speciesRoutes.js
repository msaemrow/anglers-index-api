const express = require("express");
const router = express.Router();

const fishSpeciesController = require("../controllers/speciesController");
const { adminRequired } = require("../middleware/authMiddleware");

/**
 * @openapi
 * /species/all:
 *   get:
 *     summary: Get all fish species, optionally filtered by names (semicolon separated)
 *     tags:
 *       - Species
 *     parameters:
 *       - in: query
 *         name: names
 *         schema:
 *           type: string
 *         description: Semicolon-separated list of species names to filter by (optional)
 *     responses:
 *       200:
 *         description: List of fish species (sorted alphabetically by name)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Species'
 *       500:
 *         description: Server error
 */
router.get("/", fishSpeciesController.getAllFishSpecies);

/**
 * @openapi
 * /species:
 *   post:
 *     summary: Add a new fish species (admin only)
 *     tags:
 *       - Species
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Species object to add
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Species'
 *     responses:
 *       201:
 *         description: Species created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Species'
 *       400:
 *         description: Validation error or species already exists
 *       500:
 *         description: Server error
 */
router.post("/", adminRequired, fishSpeciesController.addFishSpecies);

/**
 * @openapi
 * /species/{speciesId}:
 *   put:
 *     summary: Update master angler length for a species (admin only)
 *     tags:
 *       - Species
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: speciesId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the species to update
 *     requestBody:
 *       description: Fields to update
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - master_angler_length
 *             properties:
 *               master_angler_length:
 *                 type: number
 *     responses:
 *       200:
 *         description: Species updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Species'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Species not found
 *       500:
 *         description: Server error
 */
router.put(
  "/:speciesId",
  adminRequired,
  fishSpeciesController.updateFishSpecies
);

/**
 * @openapi
 * /species/{speciesId}:
 *   delete:
 *     summary: Delete a species by ID (admin only)
 *     tags:
 *       - Species
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: speciesId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the species to delete
 *     responses:
 *       200:
 *         description: Species deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Fish species deleted successfully"
 *       404:
 *         description: Species not found
 *       500:
 *         description: Server error
 */
router.delete(
  "/:speciesId",
  adminRequired,
  fishSpeciesController.deleteFishSpecies
);

module.exports = router;
