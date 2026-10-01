// controllers/fishCatchController.js

const { FishCatch, Lake, Lure, Species } = require("../models");
const axios = require("axios");
const { Op } = require("sequelize");
const { getCatchWeather } = require("../services/catchWeather");

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
      date,
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
      { model: Lure, as: "lure", attributes: ["brand", "name", "color", "size"] },
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

    if (date !== undefined) {
      const parsed = new Date(`${date}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
        return res.status(400).json({ error: "A valid date in YYYY-MM-DD format is required." });
      whereClause.date = date;
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
  if (!req.user) return res.status(401).json({ error: "Unauthorized. Must be logged in." });
  try {
    const { lake_id, species_id, lure_id, weight, length, date, time, timestamp, fish_image } = req.body;
    if (![lake_id, species_id, lure_id].every(value => Number.isSafeInteger(Number(value)) && Number(value) > 0))
      return res.status(400).json({ error: "Select a species, lake, and lure." });
    if (![weight, length].every(value => value != null && String(value).trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0))
      return res.status(400).json({ error: "Length and weight must be nonnegative numbers." });
    const dateValue = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || Number.isNaN(dateValue.getTime()) || dateValue.toISOString().slice(0, 10) !== date || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time || ""))
      return res.status(400).json({ error: "Enter a valid catch date and time." });
    // New clients provide the actual instant; older clients only send local date/time.
    const catchTimestamp = timestamp == null ? Math.floor(new Date(`${date}T${time}`).getTime() / 1000) : Number(timestamp);
    if (!Number.isInteger(catchTimestamp) || catchTimestamp < -2147483648 || catchTimestamp > 2147483647)
      return res.status(400).json({ error: "The catch date is outside the supported range." });
    const lake = await Lake.findByPk(Number(lake_id), {
      attributes: ["id", "latitude", "longitude"],
    });
    if (!lake) return res.status(400).json({ error: "The selected lake no longer exists." });
    let weather = {};
    let weatherWarning;
    try {
      weather = await getCatchWeather(lake, catchTimestamp);
      if (Object.values(weather).some(value => value == null))
        weatherWarning = "Some weather conditions were unavailable for this catch.";
    } catch (weatherError) {
      // Never log the Axios error/config: it contains the weather API key.
      console.warn("Catch weather unavailable", { status: weatherError.response?.status, code: weatherError.code });
      weatherWarning = "Weather could not be recorded for this catch.";
    }
    const newCatch = await FishCatch.create({
      user_id: req.user.id,
      lake_id: Number(lake_id), species_id: Number(species_id), lure_id: Number(lure_id),
      weight: Number(weight), length: Number(length), date, time,
      timestamp: catchTimestamp,
      ...weather,
      fish_image: fish_image || "/static/images/stock-fish.jpg",
    });
    const result = newCatch.toJSON();
    if (weatherWarning) result.weather_warning = weatherWarning;
    return res.status(201).json(result);
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
