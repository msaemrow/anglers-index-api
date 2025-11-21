const { TackleBox, Lure } = require("../models");

// Toggle favorite lure in user's tackle box
exports.toggleFavorite = async (req, res) => {
  const { user_id, lure_id } = req.body;

  if (!user_id || !lure_id) {
    return res.status(400).json({ error: "user_id and lure_id are required" });
  }

  try {
    const existing = await TackleBox.findOne({ where: { user_id, lure_id } });

    if (existing) {
      await existing.destroy();
      return res
        .status(200)
        .json({ message: "Lure removed from favorites", lure_id });
    } else {
      await TackleBox.create({ user_id, lure_id });
      return res
        .status(201)
        .json({ message: "Lure added to favorites", lure_id });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Get all lures in a user's tackle box
exports.getTackleBoxLures = async (req, res) => {
  const { user_id } = req.params;

  try {
    const favorites = await TackleBox.findAll({ where: { user_id } });

    if (!favorites.length) {
      return res
        .status(404)
        .json({ message: "No lures found in tackle box for this user." });
    }

    // Fetch lure details for each favorite
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

    // Filter out any null (if lure was not found)
    const filteredLures = lures.filter(Boolean);

    // Sort by brand and name alphabetically
    filteredLures.sort((a, b) => {
      const brandCompare = a.brand.localeCompare(b.brand, undefined, {
        sensitivity: "base",
      });
      if (brandCompare !== 0) return brandCompare;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    return res.status(200).json({ tackle_box: filteredLures });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
