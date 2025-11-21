const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer(); // memory storage for file uploads

const masterAnglerController = require("../controllers/masterAnglerController");
const {
  adminRequired,
  loginRequired,
} = require("../middleware/authMiddleware"); // Your auth middlewares

router.post(
  "/submit-catch",
  loginRequired,
  adminRequired,
  masterAnglerController.submitMasterAngler
);

router.get(
  "/submissions",
  // loginRequired,
  // adminRequired,
  masterAnglerController.getAllSubmissions
);

router.put(
  "/status/:master_angler_id",
  loginRequired,
  adminRequired,
  masterAnglerController.approveSubmission
);

router.put(
  "/update/data",
  loginRequired,
  adminRequired,
  masterAnglerController.updateCatchData
);

router.put(
  "/review",
  loginRequired,
  adminRequired,
  masterAnglerController.reviewSubmission
);

router.get(
  "/approved/:user_id",
  loginRequired,
  adminRequired,
  masterAnglerController.getApprovedSubmissionsByUser
);

router.post(
  "/upload-photo/:catch_id",
  loginRequired,
  adminRequired,
  upload.single("file"),
  masterAnglerController.uploadPhoto
);

router.post(
  "/certificate/:catch_id",
  loginRequired,
  adminRequired,
  masterAnglerController.generateCertificate
);

module.exports = router;
