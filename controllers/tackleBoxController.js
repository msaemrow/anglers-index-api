const { sendError } = require("../helpers/errors");
const { TackleBox, Lure } = require("../models");

// Existing clients send user_id; reject other owners and always query as req.user.
function requireOwner(req, res, suppliedId) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized. Must be logged in." });
    return false;
  }
  if (String(suppliedId) !== String(req.user.id)) {
    res.status(403).json({ error: "You can only access your own tackle box." });
    return false;
  }
  return true;
}

// Get all favorites for a user
exports.getTackleBoxLures = async (req, res) => {
  if (!requireOwner(req, res, req.params.user_id)) return;
  const user_id = req.user.id;

  try {
    const favorites = await TackleBox.findAll({
      where: { user_id },
      attributes: ["id"],
      include: [{ model: Lure, as: "lure", required: true,
        attributes: ["id", "brand", "name", "color", "size"] }],
    });
    const filteredLures = favorites.map(favorite => favorite.lure.toJSON());

    filteredLures.sort((a, b) => {
      const brandCompare = a.brand.localeCompare(b.brand, undefined, {
        sensitivity: "base",
      });
      if (brandCompare !== 0) return brandCompare;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    const brands = [...new Set(filteredLures.map((lure) => lure.brand))].sort(
      (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })
    );

    return res.status(200).json({ tackle_box: filteredLures, brands: brands });
  } catch (error) {
    return sendError(res, error, req);
  }
};

// Add lure to tackle box
exports.addFavorite = async (req, res) => {
  if (!requireOwner(req, res, req.body?.user_id)) return;
  const user_id = req.user.id;
  const { lure_id } = req.body;

  if (!user_id || !lure_id) {
    return res.status(400).json({ error: "user_id and lure_id are required" });
  }

  try {
    // Check if already exists
    const existing = await TackleBox.findOne({
      where: { user_id, lure_id },
    });

    if (existing) {
      return res.status(200).json({
        message: "Lure already in tackle box",
        lure_id,
      });
    }

    // Create new favorite
    await TackleBox.create({ user_id, lure_id });
    return res.status(201).json({
      message: "Lure added to tackle box",
      lure_id,
    });
  } catch (error) {
    return sendError(res, error, req);
  }
};

// Remove lure from tackle box (hard delete)
exports.removeFavorite = async (req, res) => {
  if (!requireOwner(req, res, req.body?.user_id)) return;
  const user_id = req.user.id;
  const { lure_id } = req.body;

  if (!user_id || !lure_id) {
    return res.status(400).json({ error: "user_id and lure_id are required" });
  }

  try {
    const deleted = await TackleBox.destroy({
      where: { user_id, lure_id },
    });

    if (!deleted) {
      return res.status(404).json({ message: "Lure not found in tackle box" });
    }

    return res.status(200).json({
      message: "Lure removed from tackle box",
      lure_id,
    });
  } catch (error) {
    return sendError(res, error, req);
  }
};
