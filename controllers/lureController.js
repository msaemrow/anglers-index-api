const { Lure, User, sequelize } = require("../models");
const { Op } = require("sequelize");

const getAllUserLures = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);

    if (!userId) {
      return res
        .status(401)
        .json({ error: "Unauthorized. Must be logged in." });
    }

    // get all "standard" lures (userId = 3) plus lures by the user
    const lures = await Lure.findAll({
      where: {
        [Op.or]: [{ userId: 3 }, { userId: userId }],
      },
    });

    return res.status(200).json(lures);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getAllLures = async (req, res) => {
  try {
    // Ideally, check admin authorization before this controller is called
    const lures = await Lure.findAll({
      order: [
        ["brand", "ASC"],
        ["name", "ASC"],
        ["color", "ASC"],
      ],
    });

    return res.status(200).json(lures);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getBrandNames = async (req, res) => {
  try {
    const brands = await Lure.findAll({
      attributes: [[sequelize.fn("DISTINCT", sequelize.col("brand")), "brand"]],
      order: [["brand", "ASC"]],
    });

    // Extract brand strings only
    const brandNames = brands.map((b) => b.brand);

    return res.status(200).json(brandNames);
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
  getAllUserLures,
  getAllLures,
  getBrandNames,
  addLure,
  editLure,
  deleteLure,
};
