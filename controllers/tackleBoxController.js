const { TackleBox, Lure } = require("../models");

// Get all favorites for a user
exports.getTackleBoxLures = async (req, res) => {
  const { user_id } = req.params;

  try {
    const favorites = await TackleBox.findAll({ where: { user_id } });

    if (!favorites.length) {
      return res.status(200).json({ tackle_box: [], brands: [] }); // Return empty instead of 404
    }

    const lures = await Promise.all(
      favorites.map(async (fav) => {
        const lure = await Lure.findByPk(fav.lure_id);
        if (!lure) return null;
        return {
          id: lure.id,
          brand: lure.brand,
          name: lure.name,
          color: lure.color,
          size: lure.size,
        };
      })
    );

    const filteredLures = lures.filter(Boolean);

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
    return res.status(500).json({ error: error.message });
  }
};

// Add lure to tackle box
exports.addFavorite = async (req, res) => {
  const { user_id, lure_id } = req.body;

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
    return res.status(500).json({ error: error.message });
  }
};

// Remove lure from tackle box (hard delete)
exports.removeFavorite = async (req, res) => {
  const { user_id, lure_id } = req.body;

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
    return res.status(500).json({ error: error.message });
  }
};
