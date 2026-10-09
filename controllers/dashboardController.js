const { FishCatch, Lake, Species, MasterAngler } = require("../models");
const { serializeAward } = require("../services/masterAnglerReview");

// Fixed-size previews; lifetime totals are calculated in the database.
exports.getDashboard = async (req, res) => {
  try {
    const where = { user_id: req.user.id };
    const awardInclude = status => ({ model: MasterAngler, as: "masterAnglerEntries", attributes: ["status"], where: { status }, required: true });
    const preview = {
      attributes: ["id", "date", "weight", "length", "master_angler"],
      include: [
        { model: MasterAngler, as: "masterAnglerEntries", attributes: ["status"], separate: true, limit: 1, order: [["id", "DESC"]] },
        { model: Lake, as: "lake", attributes: ["name"] },
        { model: Species, as: "species", attributes: ["name"] },
      ],
      order: [["date", "DESC NULLS LAST"], ["id", "DESC"]],
      limit: 5,
    };
    const [totalCatches, totalMasterAngler, lakesFished, recentCatches, recentMasterAngler, recentEligible, pendingReviews] = await Promise.all([
      FishCatch.count({ where }),
      FishCatch.count({ where, include: [awardInclude("approved")], distinct: true, col: "id" }),
      FishCatch.count({ where, distinct: true, col: "lake_id" }),
      FishCatch.findAll({ ...preview, where }),
      FishCatch.findAll({ ...preview, where, include: [awardInclude("approved"), ...preview.include.slice(1)] }),
      FishCatch.findAll({ ...preview, where, include: [awardInclude("pending"), ...preview.include.slice(1)] }),
      req.user.is_admin ? MasterAngler.findAndCountAll({
        where: { status: "pending" },
        attributes: ["id", "catch_id", "user_id", "reviewed"],
        order: [["createdAt", "DESC"], ["id", "DESC"]],
        limit: 5,
      }) : Promise.resolve(null),
    ]);
    res.set("Cache-Control", "no-store");
    return res.json({
      stats: { totalCatches, totalMasterAngler, lakesFished },
      recentCatches: recentCatches.map(serializeAward),
      recentMasterAngler: recentMasterAngler.map(serializeAward),
      recentEligible: recentEligible.map(serializeAward),
      pendingReviews: pendingReviews ? { total: pendingReviews.count, items: pendingReviews.rows } : null,
    });
  } catch (error) {
    console.error("Dashboard fetch failed:", error);
    return res.status(500).json({ error: "Unable to load dashboard." });
  }
};
