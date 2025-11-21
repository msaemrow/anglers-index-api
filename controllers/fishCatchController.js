// controllers/fishCatchController.js

const { FishCatch, Lake, Lure, Species } = require("../models");
const axios = require("axios");

const getFishCatches = async (req, res) => {
  try {
    const { user_id, catch_id, masterAngler } = req.query;

    if (catch_id) {
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
    }

    // If no catch_id, get all catches (optionally filtered)
    if (!user_id) {
      return res
        .status(400)
        .json({ error: "user_id query parameter is required" });
    }

    const whereClause = { user_id };
    if (masterAngler !== undefined) {
      whereClause.master_angler =
        masterAngler === "Y" || masterAngler === "true";
    }

    const catches = await FishCatch.findAll({
      where: whereClause,
      include: [
        { model: Lake, as: "lake" },
        { model: Lure, as: "lure" },
        { model: Species, as: "species" },
      ],
    });

    if (!catches.length) {
      return res
        .status(404)
        .json({ error: `No fish catches found for user ${user_id}` });
    }

    return res.status(200).json(catches);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getFishCatchDetails = async (req, res) => {
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

const addFishCatch = async (req, res) => {
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

const updateMasterAnglerStatus = async (req, res) => {
  try {
    const { catch_id } = req.params;
    const { master_angler } = req.body;

    const catchObj = await FishCatch.findByPk(catch_id);

    if (!catchObj) {
      return res
        .status(404)
        .json({ error: `Fish catch with ID ${catch_id} not found` });
    }

    catchObj.master_angler = master_angler;
    await catchObj.save();

    return res.status(200).json({
      message: `Master angler status updated for ID ${catch_id}`,
      fish_catch: {
        id: catchObj.id,
        master_angler: catchObj.master_angler,
      },
    });
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
  addFishCatch,
  getFishCatches,
  getFishCatchDetails,
  deleteFishCatch,
  updateMasterAnglerStatus,
};
