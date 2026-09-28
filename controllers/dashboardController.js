const { FishCatch, Lake, Species, MasterAngler } = require("../models");
const { Op } = require("sequelize");

// Fixed-size previews; lifetime totals are calculated in the database.
exports.getDashboard = async (req, res) => {
  try {
    const where = { user_id: req.user.id };
    const masterWhere = { ...where, master_angler: true };
    const preview = {
      attributes: ["id", "date", "weight", "length", "master_angler"],
      include: [
        { model: Lake, as: "lake", attributes: ["name"] },
        { model: Species, as: "species", attributes: ["name"] },
      ],
      order: [["date", "DESC NULLS LAST"], ["id", "DESC"]],
      limit: 5,
    };
    const [totalCatches, totalMasterAngler, lakesFished, recentCatches, recentMasterAngler, pendingReviews] = await Promise.all([
      FishCatch.count({ where }),
      FishCatch.count({ where: masterWhere }),
      FishCatch.count({ where, distinct: true, col: "lake_id" }),
      FishCatch.findAll({ ...preview, where }),
      FishCatch.findAll({ ...preview, where: masterWhere }),
      req.user.is_admin ? MasterAngler.findAndCountAll({
        where: { reviewed: false },
        attributes: ["id", "catch_id", "user_id", "reviewed"],
        order: [["createdAt", "DESC"], ["id", "DESC"]],
        limit: 5,
      }) : Promise.resolve(null),
    ]);
    const ids = [...new Set([...recentCatches, ...recentMasterAngler].map(c => c.id))];
    const approved = ids.length ? await MasterAngler.findAll({
      where: { user_id: req.user.id, catch_id: { [Op.in]: ids }, reviewed: true },
      attributes: ["catch_id"],
      group: ["catch_id"],
      raw: true,
    }) : [];
    const approvedIds = new Set(approved.map(entry => entry.catch_id));
    const serialize = catches => catches.map(c => ({ ...c.toJSON(), approved_master_angler: approvedIds.has(c.id) }));
    res.set("Cache-Control", "no-store");
    return res.json({
      stats: { totalCatches, totalMasterAngler, lakesFished },
      recentCatches: serialize(recentCatches),
      recentMasterAngler: serialize(recentMasterAngler),
      pendingReviews: pendingReviews ? { total: pendingReviews.count, items: pendingReviews.rows } : null,
    });
  } catch (error) {
    console.error("Dashboard fetch failed:", error);
    return res.status(500).json({ error: "Unable to load dashboard." });
  }
};
