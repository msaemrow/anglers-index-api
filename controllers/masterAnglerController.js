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

exports.submitMasterAngler = async (req, res) => {
  const { user_id, catch_id } = req.body;

  if (!user_id || !catch_id) {
    return res.status(400).json({ error: "User ID and Catch ID are required" });
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

    return res.status(200).json(submission);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.errors.map((e) => e.message) });
    }
    return res
      .status(500)
      .json({ error: "Unexpected error", details: err.message });
  }
};

exports.getAllSubmissions = async (req, res) => {
  try {
    const submissions = await MasterAngler.findAll({
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

exports.approveSubmission = async (req, res) => {
  const { master_angler_id } = req.params;
  const { reviewed } = req.body;

  try {
    const submission = await MasterAngler.findByPk(master_angler_id);
    if (!submission) {
      return res
        .status(404)
        .json({ error: "Master Angler submission not found" });
    }

    submission.reviewed = reviewed;
    await submission.save();

    return res.status(200).json(submission);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.updateCatchData = async (req, res) => {
  const { catch_id, witness, photo_url } = req.body;

  if (!catch_id || !witness || !photo_url) {
    return res
      .status(400)
      .json({ error: "Catch ID, Witness, and Photo URL are required" });
  }

  try {
    const fishCatch = await FishCatch.findByPk(catch_id);
    if (!fishCatch) {
      return res.status(404).json({ error: "Fish catch not found" });
    }

    fishCatch.witness = witness;
    fishCatch.fish_image = photo_url;

    await fishCatch.save();

    return res.status(200).json({ status: "success" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.reviewSubmission = async (req, res) => {
  const { catch_id, reviewed } = req.body;

  if (!catch_id || reviewed === undefined) {
    return res
      .status(400)
      .json({ error: "Catch ID and Reviewed status are required" });
  }

  try {
    const submission = await MasterAngler.findOne({ where: { catch_id } });
    if (!submission) {
      return res.status(404).json({
        error: `Master Angler submission for catch ID ${catch_id} not found`,
      });
    }

    submission.reviewed = reviewed;
    await submission.save();

    return res.status(200).json({ status: "success" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getApprovedSubmissionsByUser = async (req, res) => {
  const { user_id } = req.params;

  try {
    const submissions = await MasterAngler.findAll({
      where: { user_id, reviewed: true },
      include: [{ model: FishCatch, as: "catch" }],
    });

    if (submissions.length === 0) {
      return res.status(404).json({
        error: "No approved Master Angler submissions found for the user",
      });
    }

    // Prepare data with catch details
    const results = submissions.map((sub) => {
      const fishCatch = sub.catch;
      return {
        id: fishCatch.id,
        date: fishCatch.date ? fishCatch.date.toISOString() : null,
        time: fishCatch.time
          ? fishCatch.time.toISOString().substr(11, 8)
          : null,
        lake_id: fishCatch.lake_id,
        species_id: fishCatch.species_id,
        length: fishCatch.length,
        weight: fishCatch.weight,
        barometric: fishCatch.barometric,
        temperature: fishCatch.temperature,
        weather_conditions: fishCatch.weather_conditions,
        wind_speed: fishCatch.wind_speed,
        wind_direction: fishCatch.wind_direction,
        lure_id: fishCatch.lure_id,
        fish_image: fishCatch.fish_image,
        witness: fishCatch.witness,
        master_angler: fishCatch.master_angler,
      };
    });

    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.uploadPhoto = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file attached" });
  }

  const { catch_id } = req.params;
  const file = req.file;

  const extension = path.extname(file.originalname);
  const filename = `master_angler_${catch_id}${extension}`;

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
    console.error("Error uploading to S3:", err);
    return res.status(500).json({ error: "Error uploading file" });
  }
};

exports.generateCertificate = async (req, res) => {
  const { catch_id } = req.params;

  // Placeholder: Implement PDF generation using a Node.js library such as pdf-lib, pdfkit, or puppeteer.
  // You can fetch fish catch, user, lake, species, lure info as in Python code,
  // then generate a PDF and send it as a file stream in the response.

  res.status(501).json({ error: "PDF certificate generation not implemented" });
};
