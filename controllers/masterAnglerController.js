const {
  MasterAngler,
  FishCatch,
  User,
  Species,
  Lake,
  Lure,
} = require("../models");

/**
 * GET /master-angler
 * Supports filtering by:
 *  - user_id
 *  - reviewed
 *  - species_id
 */
const { DENIAL_REASONS, isEligible } = require("../services/masterAnglerReview");
exports.getAllMasterAnglerCatches = async (req, res) => {
  try {
    const submissions = await MasterAngler.findAll({
      where: { status: "pending" },
      include: [
        { model: User, as: "user", attributes: ["id", "username", "first_name", "last_name"] },
        { model: FishCatch, as: "catch", required: true, include: [
          { model: Species, as: "species" }, { model: Lake, as: "lake" }, { model: Lure, as: "lure" },
        ] },
      ], order: [["createdAt", "ASC"], ["id", "ASC"]],
    });
    return res.json({ items: submissions, denialReasons: DENIAL_REASONS });
  } catch (error) { return res.status(500).json({ error: "Unable to load Master Angler reviews." }); }
};
exports.submitMasterAngler = async (req, res) => {
  // Catch creation/editing automatically queues eligible catches.
  return res.status(400).json({ error: "Eligible catches are submitted automatically when saved." });
};
exports.updateMasterAnglerSubmission = async (req, res) => {
  const { status, denial_reason } = req.body;
  if (!["approved", "denied"].includes(status) || (status === "denied" && !DENIAL_REASONS.includes(denial_reason)))
    return res.status(400).json({ error: "Select approved or denied and a valid denial reason." });
  const { sequelize } = require("../models");
  try {
    const result = await sequelize.transaction(async transaction => {
      // Lock the catch first, in the same order as catch edits.
      const entry = await MasterAngler.findByPk(req.params.id, { transaction });
      if (!entry) return { code: 404, error: "Submission not found." };
      const fish = await FishCatch.findByPk(entry.catch_id, { transaction,
        include: [{ model: Species, as: "species" }], lock: { level: transaction.LOCK.UPDATE, of: FishCatch } });
      const submission = await MasterAngler.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!submission || submission.status !== "pending") return { code: 409, error: "This catch has already been reviewed or changed. Refresh the queue." };
      if (!fish || !isEligible(fish)) return { code: 409, error: "This catch no longer meets the eligibility requirements." };
      await fish.update({ master_angler: status === "approved" }, { transaction });
      await submission.update({ status, denial_reason: status === "denied" ? denial_reason : null,
        reviewed: true, reviewed_by: req.user.id, reviewed_at: new Date() }, { transaction });
      return { submission };
    });
    if (result.error) return res.status(result.code).json({ error: result.error });
    return res.json(result.submission);
  } catch (error) { return res.status(500).json({ error: "Unable to save the review." }); }
};

/**
 * GET /master-angler/approved/:user_id
 */
exports.getApprovedSubmissionsByUser = async (req, res) => {
  const { user_id } = req.params;

  try {
    const submissions = await MasterAngler.findAll({
      where: { user_id, status: "approved" },
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
 * POST /masterangler/:id/certificate
 * The ID is a fish catch ID. An approved review is required.
 */
exports.generateCertificate = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Please sign in to generate a certificate." });
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0)
    return res.status(400).json({ error: "A valid catch ID is required." });
  try {
    const fish = await FishCatch.findByPk(id, {
      include: [
        { model: User, as: "user", attributes: ["first_name", "last_name", "username"] },
        { model: Species, as: "species", attributes: ["name"] },
        { model: Lake, as: "lake", attributes: ["name", "county", "state"] },
      ],
    });
    if (!fish) return res.status(404).json({ error: "Fish catch not found." });
    if (String(fish.user_id) !== String(req.user.id) && !req.user.is_admin)
      return res.status(403).json({ error: "You can only generate certificates for your own catches." });
    if (fish.master_angler !== true)
      return res.status(403).json({ error: "This catch is not marked as a Master Angler catch." });
    const approved = await MasterAngler.findOne({ where: { catch_id: id, user_id: fish.user_id, status: "approved" } });
    if (!approved) return res.status(403).json({ error: "This catch must be reviewed and approved before generating a certificate." });
    const { createMasterAnglerCertificate } = require("../services/masterAnglerCertificate");
    const pdf = await createMasterAnglerCertificate(fish);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="master_angler_${id}_certificate.pdf"`,
      "Cache-Control": "no-store",
    });
    return res.status(200).send(pdf);
  } catch (error) {
    console.error("Certificate generation failed:", error);
    return res.status(500).json({ error: "Unable to generate the certificate. Please try again." });
  }
};
