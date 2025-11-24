const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer();

const masterAnglerController = require("../controllers/masterAnglerController");
const {
  adminRequired,
  loginRequired,
} = require("../middleware/authMiddleware");

/**
 * @openapi
 * /master-angler:
 *   post:
 *     summary: Submit a Master Angler catch
 *     tags: [Master Angler]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id, catch_id]
 *             properties:
 *               user_id:
 *                 type: integer
 *               catch_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Successfully submitted
 */
router.post(
  "/",
  loginRequired,
  adminRequired,
  masterAnglerController.submitMasterAngler
);

/**
 * @openapi
 * /master-angler:
 *   get:
 *     summary: Get all Master Angler submissions
 *     tags: [Master Angler]
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: reviewed
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: species_id
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of Master Angler submissions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/MasterAngler"
 */
router.get("/", masterAnglerController.getAllMasterAnglerCatches);

/**
 * @openapi
 * /master-angler/{id}:
 *   patch:
 *     summary: Update a Master Angler submission
 *     tags: [Master Angler]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Fields to update
 *             properties:
 *               reviewed:
 *                 type: boolean
 *               witness:
 *                 type: string
 *               photo_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully updated
 */
router.patch(
  "/:id",
  loginRequired,
  adminRequired,
  masterAnglerController.updateMasterAnglerSubmission
);

/**
 * @openapi
 * /master-angler/{id}/photo:
 *   post:
 *     summary: Upload a photo for a Master Angler catch
 *     tags: [Master Angler]
 */
router.post(
  "/:id/photo",
  loginRequired,
  adminRequired,
  upload.single("file"),
  masterAnglerController.uploadPhoto
);

/**
 * @openapi
 * /master-angler/{id}/certificate:
 *   post:
 *     summary: Generate a certificate for a catch
 *     tags: [Master Angler]
 */
router.post(
  "/:id/certificate",
  loginRequired,
  adminRequired,
  masterAnglerController.generateCertificate
);

module.exports = router;
