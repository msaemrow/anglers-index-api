const { TackleBox, Lure } = require("../models");

// Get all favorites for a user
exports.getTackleBoxLures = async (req, res) => {
  const { user_id } = req.params;

  try {
    const favorites = await TackleBox.findAll({ where: { user_id } });

    if (!favorites.length) {
      return res
        .status(404)
        .json({ message: "No lures found in tackle box for this user." });
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

    return res.status(200).json({ tackle_box: filteredLures });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Add lure to favorites
exports.addFavorite = async (req, res) => {
  const { user_id, lure_id } = req.body;

  if (!user_id || !lure_id) {
    return res.status(400).json({ error: "user_id and lure_id are required" });
  }

  try {
    // Check if favorite exists including soft deleted
    const existing = await TackleBox.findOne({
      where: { user_id, lure_id },
      paranoid: false, // include soft deleted records
    });

    if (existing) {
      if (existing.deletedAt) {
        // If soft deleted, restore it
        await existing.restore();
        return res
          .status(200)
          .json({ message: "Lure restored to favorites", lure_id });
      } else {
        // Already exists and active
        return res
          .status(409)
          .json({ message: "Lure already in favorites", lure_id });
      }
    }

    // Create new favorite
    await TackleBox.create({ user_id, lure_id });
    return res
      .status(201)
      .json({ message: "Lure added to favorites", lure_id });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Remove lure from favorites (soft delete)
exports.removeFavorite = async (req, res) => {
  const { user_id, lure_id } = req.body;

  if (!user_id || !lure_id) {
    return res.status(400).json({ error: "user_id and lure_id are required" });
  }

  try {
    const existing = await TackleBox.findOne({ where: { user_id, lure_id } });

    if (!existing) {
      return res.status(404).json({ message: "Favorite not found" });
    }

    await existing.destroy(); // soft delete due to paranoid:true
    return res
      .status(200)
      .json({ message: "Lure removed from favorites", lure_id });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Restore a soft deleted favorite
exports.restoreFavorite = async (req, res) => {
  const { user_id, lure_id } = req.body;

  if (!user_id || !lure_id) {
    return res.status(400).json({ error: "user_id and lure_id are required" });
  }

  try {
    const deletedFavorite = await TackleBox.findOne({
      where: { user_id, lure_id },
      paranoid: false,
    });

    if (!deletedFavorite) {
      return res
        .status(404)
        .json({ message: "Favorite not found (even soft deleted)" });
    }

    if (!deletedFavorite.deletedAt) {
      return res
        .status(400)
        .json({ message: "Favorite is not deleted, cannot restore" });
    }

    await deletedFavorite.restore();
    return res.status(200).json({ message: "Favorite restored", lure_id });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
