// controllers/fishCatchController.js

const { FishCatch, Lake, Lure, Species } = require("../models");
const axios = require("axios");
const { Op } = require("sequelize");

const getAllFishCatches = async (req, res) => {
  try {
    const {
      user_id,
      catch_id,
      masterAngler,
      orderBy,
      minLength,
      minWeight,
      species_id,
    } = req.query;

    let whereClause = {};

    const attributes = {
      exclude: [
        "createdAt",
        "updatedAt",
        "deletedAt",
        "timestamp",
        "barometric",
        "temperature",
        "weather_conditions",
        "wind_direction",
        "wind_speed",
        "fish_image",
        "witness",
      ],
    };

    const include = [
      { model: Lake, as: "lake", attributes: ["name"] },
      { model: Lure, as: "lure", attributes: ["brand", "name", "color"] },
      { model: Species, as: "species", attributes: ["name"] },
    ];

    const buildOrder = (orderByParam) => {
      const validFields = ["date", "weight", "length", "createdAt"];
      if (!orderByParam) return [["date", "DESC"]];

      const [field, directionRaw] = orderByParam.split(":");
      const direction = directionRaw ? directionRaw.toUpperCase() : "DESC";

      if (!validFields.includes(field)) return [["timestamp", "DESC"]];
      if (!["ASC", "DESC"].includes(direction)) return [["timestamp", "DESC"]];

      return [[field, direction]];
    };

    if (catch_id) {
      const idList = catch_id
        .split(";")
        .map((id) => parseInt(id.trim()))
        .filter((n) => !isNaN(n));
      whereClause.id = idList.length === 1 ? idList[0] : idList;
    }

    if (user_id) {
      whereClause.user_id = user_id;
    }

    if (masterAngler !== undefined) {
      whereClause.master_angler =
        masterAngler === "Y" || masterAngler === "true";
    }

    if (minLength !== undefined) {
      whereClause.length = { [Op.gte]: parseFloat(minLength) };
    }

    if (minWeight !== undefined) {
      whereClause.weight = { [Op.gte]: parseFloat(minWeight) };
    }

    if (species_id) {
      whereClause.species_id = species_id;
    }

    if (Object.keys(whereClause).length === 0) {
      return res.status(400).json({
        error: "At least one filter parameter must be provided.",
      });
    }

    const catches = await FishCatch.findAll({
      where: whereClause,
      attributes,
      include,
      order: buildOrder(orderBy),
    });

    if (!catches.length) {
      return res
        .status(404)
        .json({ error: "No fish catches found matching criteria" });
    }

    return res.status(200).json(catches);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getFishCatchById = async (req, res) => {
  try {
    const { catch_id } = req.params;

    const catchObj = await FishCatch.findByPk(catch_id, {
      include: [
        { model: Lake, as: "lake" },
        { model: Lure, as: "lure" },
        { model: Species, as: "species" },
      ],
    });

    if (!catchObj) {
      return res
        .status(404)
        .json({ error: `Fish catch with ID ${catch_id} not found` });
    }

    return res.status(200).json(catchObj);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createFishCatch = async (req, res) => {
  try {
    const {
      user_id,
      lake_id,
      species_id,
      lure_id,
      weight,
      length,
      date,
      time,
      fish_image,
    } = req.body;

    const newCatch = await FishCatch.create({
      user_id,
      lake_id,
      species_id,
      lure_id,
      weight,
      length,
      date,
      time,
      image: fish_image || "/static/images/stock-fish.jpg",
    });

    return res.status(201).json(newCatch);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

const updateFishCatch = async (req, res) => {
  try {
    const { catch_id } = req.params;
    const updates = req.body;

    const catchObj = await FishCatch.findByPk(catch_id);

    if (!catchObj) {
      return res
        .status(404)
        .json({ error: `Fish catch with ID ${catch_id} not found` });
    }

    // Update only provided fields
    Object.keys(updates).forEach((key) => {
      catchObj[key] = updates[key];
    });

    await catchObj.save();

    return res.status(200).json(catchObj);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

const deleteFishCatch = async (req, res) => {
  try {
    const { catch_id } = req.params;

    const catchObj = await FishCatch.findByPk(catch_id);

    if (!catchObj) {
      return res
        .status(404)
        .json({ error: `Fish catch with ID ${catch_id} not found` });
    }

    await catchObj.destroy();

    return res
      .status(200)
      .json({ message: `Fish catch with ID ${catch_id} deleted successfully` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getWeather = async (req, res) => {
  try {
    const { lat, long, dt } = req.body;

    if (!lat || !long || !dt) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const weatherData = await axios.get(
      `https://api.openweathermap.org/data/3.0/onecall/timemachine`,
      {
        params: {
          lat,
          lon: long,
          dt,
          appid: process.env.WEATHER_API_KEY,
        },
      }
    );

    return res.status(200).json(weatherData.data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getWeather,
  getAllFishCatches,
  getFishCatchById,
  updateFishCatch,
  createFishCatch,
  deleteFishCatch,
};
