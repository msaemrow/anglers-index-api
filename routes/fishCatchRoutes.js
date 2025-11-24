const express = require("express");
const router = express.Router();
const fishCatchController = require("../controllers/fishCatchController");

/**
 * @openapi
 * /fishcatch:
 *   get:
 *     summary: Get fish catches with options to filter
 *     tags:
 *       - FishCatch
 *     parameters:
 *       - in: query
 *         name: user_id
 *         required: false
 *         schema:
 *           type: integer
 *         description: ID of the user whose catches to retrieve (required unless catch_id is provided)
 *       - in: query
 *         name: catch_id
 *         required: false
 *         schema:
 *           type: string
 *           example: "12;15;20"
 *         description: Semicolon-separated list of fish catch IDs to retrieve (e.g. "12;15;20")
 *       - in: query
 *         description: ID of the species of fish catch to retrieve
 *         name: species_id
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: masterAngler
 *         required: false
 *         schema:
 *           type: string
 *           enum: ["Y"]
 *         description: Filter catches by master angler status "Y"
 *       - in: query
 *         description: Return all catches greater than or equal to this length
 *         name: minLength
 *         schema:
 *           type: integer
 *       - in: query
 *         description: Return all catches greater than or equal to this weight
 *         name: minWeight
 *         schema:
 *           type: integer
 *       - in: query
 *         name: orderBy
 *         required: false
 *         schema:
 *           type: string
 *           example: "date:desc"
 *           description: Field and direction to order by, e.g. "date:desc", "weight:asc". Defaults to "timestamp:desc".
 *     responses:
 *       200:
 *         description: Fish catch or list of fish catches returned
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/FishCatch'
 *                 - type: array
 *                   items:
 *                     $ref: '#/components/schemas/FishCatch'
 *       400:
 *         description: Missing required parameters
 *       404:
 *         description: Fish catch(es) not found
 */
router.get("/", fishCatchController.getAllFishCatches);

/**
 * @openapi
 * /fishcatch/{catch_id}:
 *   get:
 *     summary: Get a single fish catch by ID
 *     tags:
 *       - FishCatch
 *     parameters:
 *       - in: path
 *         name: catch_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the fish catch to fetch
 *     responses:
 *       200:
 *         description: Fish catch returned
 *       404:
 *         description: Fish catch not found
 */
router.get("/:catch_id", fishCatchController.getFishCatchById);

/**
 * @openapi
 * /fishcatch/{catch_id}:
 *   patch:
 *     summary: Partially update a fish catch by ID
 *     tags:
 *       - FishCatch
 *     parameters:
 *       - in: path
 *         name: catch_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the fish catch to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               master_angler:
 *                 type: boolean
 *               weight:
 *                 type: number
 *               length:
 *                 type: number
 *               date:
 *                 type: string
 *                 format: date
 *               time:
 *                 type: string
 *                 format: time
 *     responses:
 *       200:
 *         description: Fish catch updated successfully
 *       404:
 *         description: Fish catch not found
 */
router.patch("/:catch_id", fishCatchController.updateFishCatch);

/**
 * @openapi
 * /fishcatch:
 *   post:
 *     summary: Add a new fish catch
 *     tags:
 *       - FishCatch
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FishCatch'
 *     responses:
 *       201:
 *         description: Fish catch created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FishCatch'
 *       400:
 *         description: Invalid request data
 */
router.post("/", fishCatchController.createFishCatch);

/**
 * @openapi
 * /fishcatch/{catch_id}:
 *   delete:
 *     summary: Delete a fish catch by ID
 *     tags:
 *       - FishCatch
 *     parameters:
 *       - in: path
 *         name: catch_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the fish catch to delete
 *     responses:
 *       200:
 *         description: Fish catch deleted successfully
 *       404:
 *         description: Fish catch not found
 */
router.delete("/:catch_id", fishCatchController.deleteFishCatch);

/**
 * @openapi
 * /fishcatch/weather:
 *   post:
 *     summary: Get weather information for a fish catch location
 *     tags:
 *       - FishCatch
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lat:
 *                 type: number
 *                 format: float
 *               long:
 *                 type: number
 *                 format: float
 *               dt:
 *                 type: integer
 *                 description: Unix timestamp of the requested date/time
 *             required:
 *               - lat
 *               - long
 *               - dt
 *     responses:
 *       200:
 *         description: Weather information returned
 *       400:
 *         description: Missing required parameters
 */
router.post("/weather", fishCatchController.getWeather);

module.exports = router;
