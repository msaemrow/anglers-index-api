const {
  MasterAngler,
  FishCatch,
  User,
  Species,
  Lake,
  Lure,
} = require("../models");

const AWS = require("aws-sdk");
const path = require("path");
const { ValidationError } = require("sequelize");

const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const bucketName = "anglers-index";

/**
 * GET /master-angler
 * Supports filtering by:
 *  - user_id
 *  - reviewed
 *  - species_id
 */
exports.getAllMasterAnglerCatches = async (req, res) => {
  try {
    const { user_id, reviewed, species_id } = req.query;

    const where = {};

    if (user_id) where.user_id = user_id;
    if (reviewed !== undefined) where.reviewed = reviewed === "true";
    if (species_id) where["$catch.species_id$"] = species_id;

    const submissions = await MasterAngler.findAll({
      where,
      order: [["createdAt", "DESC"]],
      include: [
        { model: User, as: "user" },
        {
          model: FishCatch,
          as: "catch",
          include: [
            { model: Species, as: "species" },
            { model: Lake, as: "lake" },
            { model: Lure, as: "lure" },
          ],
        },
      ],
    });

    return res.status(200).json(submissions);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * POST /master-angler
 * Create a new submission
 */
exports.submitMasterAngler = async (req, res) => {
  const { user_id, catch_id } = req.body;

  if (!user_id || !catch_id) {
    return res.status(400).json({ error: "user_id and catch_id are required" });
  }

  try {
    const fishCatch = await FishCatch.findByPk(catch_id);
    if (!fishCatch) {
      return res.status(404).json({ error: "Fish catch not found" });
    }

    const submission = await MasterAngler.create({
      user_id,
      catch_id,
      reviewed: false,
    });

    return res.status(201).json(submission);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({
        error: err.errors.map((e) => e.message),
      });
    }

    return res.status(500).json({ error: err.message });
  }
};

/**
 * PATCH /master-angler/:id
 * Unified update method for:
 *  - reviewed flag
 *  - witness update
 *  - fish_image update
 */
exports.updateMasterAnglerSubmission = async (req, res) => {
  const { id } = req.params;
  const { reviewed, witness, photo_url } = req.body;

  try {
    const submission = await MasterAngler.findByPk(id, {
      include: [{ model: FishCatch, as: "catch" }],
    });

    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    // Update submission fields
    if (typeof reviewed !== "undefined") {
      submission.reviewed = reviewed;
      await submission.save();
    }

    // Update catch metadata if provided
    if (witness || photo_url) {
      const fishCatch = submission.catch;

      if (!fishCatch) {
        return res.status(400).json({
          error: "Catch data missing for this submission",
        });
      }

      if (witness) fishCatch.witness = witness;
      if (photo_url) fishCatch.fish_image = photo_url;

      await fishCatch.save();
    }

    return res.status(200).json({ message: "Updated successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * GET /master-angler/approved/:user_id
 */
exports.getApprovedSubmissionsByUser = async (req, res) => {
  const { user_id } = req.params;

  try {
    const submissions = await MasterAngler.findAll({
      where: { user_id, reviewed: true },
      include: [{ model: FishCatch, as: "catch" }],
      order: [["createdAt", "DESC"]],
    });

    if (submissions.length === 0) {
      return res.status(404).json({
        error: "No approved Master Angler submissions found",
      });
    }

    // Format response
    const results = submissions.map((sub) => {
      const c = sub.catch;

      return {
        id: c.id,
        date: c.date ? c.date.toISOString() : null,
        time: c.time ? c.time.toISOString().substring(11, 19) : null,
        lake_id: c.lake_id,
        species_id: c.species_id,
        length: c.length,
        weight: c.weight,
        barometric: c.barometric,
        temperature: c.temperature,
        weather_conditions: c.weather_conditions,
        wind_speed: c.wind_speed,
        wind_direction: c.wind_direction,
        lure_id: c.lure_id,
        fish_image: c.fish_image,
        witness: c.witness,
        master_angler: c.master_angler,
      };
    });

    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * POST /master-angler/:id/photo
 * Upload photo to S3
 */
exports.uploadPhoto = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file attached" });
  }

  const { id } = req.params;
  const file = req.file;

  const extension = path.extname(file.originalname);
  const filename = `master_angler_${id}${extension}`;

  try {
    await s3
      .putObject({
        Bucket: bucketName,
        Key: filename,
        Body: file.buffer,
        ACL: "public-read",
      })
      .promise();

    const photoUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;

    return res.status(200).json({ url: photoUrl });
  } catch (err) {
    return res.status(500).json({ error: "Error uploading file" });
  }
};

/**
 * POST /master-angler/:id/certificate
 * TODO: PDF generation
 */
exports.generateCertificate = async (req, res) => {
  return res
    .status(501)
    .json({ error: "PDF certificate generation not implemented" });
};
