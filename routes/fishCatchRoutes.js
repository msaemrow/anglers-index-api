const express = require("express");
const router = express.Router();
const fishCatchController = require("../controllers/fishCatchController");

/**
 * @openapi
 * /fishcatch:
 *   get:
 *     summary: Get fish catches filtered by user_id, catch_id, or master angler status
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
 *           type: integer
 *         description: Specific fish catch ID to retrieve
 *       - in: query
 *         name: masterAngler
 *         required: false
 *         schema:
 *           type: string
 *           enum: ["Y"]
 *         description: Filter catches by master angler status "Y"
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
router.get("/", fishCatchController.getFishCatches);

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
router.post("/", fishCatchController.addFishCatch);

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
 * /fishcatch/{catch_id}/master-angler:
 *   put:
 *     summary: Update master angler status for a fish catch
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
 *             required:
 *               - master_angler
 *     responses:
 *       200:
 *         description: Master angler status updated
 *       404:
 *         description: Fish catch not found
 */
router.put(
  "/:catch_id/master-angler",
  fishCatchController.updateMasterAnglerStatus
);

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
