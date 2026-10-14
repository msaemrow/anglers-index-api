const DENIAL_REASONS = [
  "Photo does not match the recorded length",
  "Photo appears modified",
  "Fish species does not match the catch",
  "Measurement is not clearly visible in the photo",
  "Witness information is invalid",
];
function isEligible(fish, species = fish.species) {
  const witness = String(fish.witness || "").trim();
  const photo = String(fish.fish_image || "").trim();
  return Number.isFinite(Number(fish.length)) && Number(species?.master_angler_length) > 0 &&
    Number(fish.length) >= Number(species.master_angler_length) &&
    !!witness && !["na", "n/a", "none"].includes(witness.toLowerCase()) &&
    !!photo && !photo.includes("stock-fish.jpg") &&
    require("./catchPhotos").isPhotoKey(photo);
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
module.exports = { DENIAL_REASONS, isEligible, syncSubmission, awardFields, serializeAward };
