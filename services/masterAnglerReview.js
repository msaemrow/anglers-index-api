const DENIAL_REASONS = [
  "Photo does not match the recorded length",
  "Photo appears modified",
  "Fish species does not match the catch",
  "Measurement is not clearly visible in the photo",
  "Witness information is invalid",
];
function eligibilityIssues(fish, species = fish.species) {
  const issues = [];
  const witness = String(fish.witness || "").trim();
  const photo = String(fish.fish_image || "").trim();
  const requiredLength = Number(species?.master_angler_length);
  if (!(requiredLength > 0)) issues.push("The species has no Master Angler qualifying length.");
  else if (!Number.isFinite(Number(fish.length)) || Number(fish.length) < requiredLength)
    issues.push(`The catch must measure at least ${requiredLength} inches.`);
  if (!witness || ["na", "n/a", "none"].includes(witness.toLowerCase()))
    issues.push("A valid witness is required.");
  if (!require("./catchPhotos").isPhotoKey(photo))
    issues.push("Upload a catch photo; older photo links and placeholder images do not qualify.");
  return issues;
}
function isEligible(fish, species = fish.species) {
  return eligibilityIssues(fish, species).length === 0;
}
async function syncSubmission(fish, transaction, { preserveApproval = false, species } = {}) {
  const { MasterAngler, Species } = require("../models");
  const previous = await MasterAngler.findOne({
    where: { catch_id: fish.id }, order: [["id", "DESC"]], transaction,
  });
  // Admin decisions cannot be granted or cleared by eligibility checks.
  if (previous?.status === "denied" || (preserveApproval && previous?.status === "approved")) {
    fish.master_angler = previous.status === "approved";
    await fish.save({ transaction });
    return previous;
  }
  const catchSpecies = species || await Species.findByPk(fish.species_id, { transaction });
  const status = isEligible(fish, catchSpecies) ? "pending" : "not_eligible";
  fish.master_angler = false;
  await fish.save({ transaction });
  const fields = { user_id: fish.user_id, catch_id: fish.id, status, reviewed: false,
    denial_reason: null, reviewed_by: null, reviewed_at: null };
  // Keep completed review history when an approved catch's evidence changes.
  if (previous?.status === "approved") {
    await previous.destroy({ transaction });
    return MasterAngler.create(fields, { transaction });
  }
  if (previous) return previous.update(fields, { transaction });
  return MasterAngler.create(fields, { transaction });
}
// Recheck pending submissions only; completed admin decisions are preserved.
async function reconcilePendingSubmissions({ userId } = {}) {
  const { MasterAngler, FishCatch, Species, sequelize } = require("../models");
  const candidates = await MasterAngler.findAll({
    where: { status: "pending", ...(userId == null ? {} : { user_id: userId }) },
    attributes: ["id", "catch_id"],
    include: [{ model: FishCatch, as: "catch", required: true,
      attributes: ["id", "length", "witness", "fish_image"],
      include: [{ model: Species, as: "species", attributes: ["master_angler_length"] }] }],
  });
  for (const candidate of candidates) {
    if (isEligible(candidate.catch)) continue;
    await sequelize.transaction(async transaction => {
      // Match the catch-edit lock order and recheck after taking the locks.
      const fish = await FishCatch.findByPk(candidate.catch_id, { transaction,
        include: [{ model: Species, as: "species" }],
        lock: { level: transaction.LOCK.UPDATE, of: FishCatch } });
      const submission = await MasterAngler.findByPk(candidate.id, {
        transaction, lock: transaction.LOCK.UPDATE,
      });
      if (!fish || submission?.status !== "pending" || isEligible(fish)) return;
      await markIneligible(fish, submission, transaction);
    });
  }
}
async function markIneligible(fish, submission, transaction) {
  await fish.update({ master_angler: false }, { transaction });
  await submission.update({ status: "not_eligible", reviewed: false,
    denial_reason: null, reviewed_by: null, reviewed_at: null }, { transaction });
}
function awardFields(fish, review) {
  const status = review?.status || "not_eligible";
  return {
    master_angler_status: status,
    master_angler: status === "approved",
    approved_master_angler: status === "approved",
    eligible_master_angler: status === "pending",
  };
}
function serializeAward(fish) {
  const data = fish.toJSON();
  const review = data.masterAnglerEntries?.[0];
  delete data.masterAnglerEntries;
  return { ...data, ...awardFields(data, review) };
}
module.exports = { DENIAL_REASONS, eligibilityIssues, isEligible, syncSubmission, reconcilePendingSubmissions, markIneligible, awardFields, serializeAward };
