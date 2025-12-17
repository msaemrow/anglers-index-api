const { Lure, User, sequelize } = require("../models");
const { Op } = require("sequelize");

const getLures = async (req, res) => {
  try {
    const { user_id, brand, name, color, brands_only, lures_only } = req.query;

    if (brands_only && brands_only === "Y") {
      // Only distinct brands
      const brands = await Lure.findAll({
        attributes: [
          [sequelize.fn("DISTINCT", sequelize.col("brand")), "brand"],
        ],
        order: [["brand", "ASC"]],
      });
      return res.status(200).json(brands.map((b) => b.brand));
    }

    // Build where clause for filtered lures
    let whereClause = {};
    if (user_id) whereClause.user_id = { [Op.or]: [3, parseInt(user_id, 10)] };
    if (brand) whereClause.brand = { [Op.iLike]: `%${brand}%` };
    if (name) whereClause.name = { [Op.iLike]: `%${name}%` };
    if (color) whereClause.color = { [Op.iLike]: `%${color}%` };

    const includeUser = user_id
      ? [
          {
            model: User,
            as: "owner",
            attributes: ["id", "username", "email"],
          },
        ]
      : [];

    const lures = await Lure.findAll({
      where: whereClause,
      include: includeUser,
      order: [
        ["brand", "ASC"],
        ["name", "ASC"],
        ["color", "ASC"],
      ],
    });

    if (lures_only && lures_only === "Y") {
      // Only return lures array
      return res.status(200).json(lures);
    }

    // Otherwise, get distinct brands as well
    const brandRecords = await Lure.findAll({
      attributes: [[sequelize.fn("DISTINCT", sequelize.col("brand")), "brand"]],
      order: [["brand", "ASC"]],
    });
    const brands = brandRecords.map((b) => b.brand);

    return res.status(200).json({ lures, brands });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getLureById = async (req, res) => {
  try {
    const lureId = parseInt(req.params.lureId, 10);

    const lure = await Lure.findByPk(lureId, {
      include: [
        {
          model: User,
          as: "owner",
          attributes: ["id", "username", "email"],
        },
      ],
    });

    if (!lure) {
      return res.status(404).json({ error: "Lure not found" });
    }

    return res.status(200).json(lure);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const addLure = async (req, res) => {
  try {
    const { userId, name, brand, color, size } = req.body;

    if (!userId || !name || !brand || !color || !size) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newLure = await Lure.create({
      userId,
      name,
      brand,
      color,
      size,
    });

    return res.status(201).json(newLure);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({ error: "Lure already exists" });
    }
    return res.status(500).json({ error: error.message });
  }
};

const editLure = async (req, res) => {
  try {
    const lureId = parseInt(req.params.lureId, 10);
    const { brand, name, color, size } = req.body;

    const lure = await Lure.findByPk(lureId);
    if (!lure) {
      return res.status(404).json({ error: "Lure not found" });
    }

    lure.brand = brand || lure.brand;
    lure.name = name || lure.name;
    lure.color = color || lure.color;
    lure.size = size || lure.size;

    await lure.save();

    return res.status(200).json(lure);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const deleteLure = async (req, res) => {
  try {
    const lureId = parseInt(req.params.lureId, 10);

    const lure = await Lure.findByPk(lureId);
    if (!lure) {
      return res.status(404).json({ error: "Lure not found" });
    }

    await lure.destroy();

    return res.status(200).json({ message: "Lure deleted successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getLures,
  getLureById,
  addLure,
  editLure,
  deleteLure,
};
