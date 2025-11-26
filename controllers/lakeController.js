// controllers/lakeController.js
require("dotenv").config();
const axios = require("axios");
const { Lake } = require("../models");
const { Op } = require("sequelize");

// Helper: get lat/long from OpenWeatherMap API
async function getLakeLatLong(nearest_town, state) {
  const API_KEY = process.env.WEATHER_API_KEY;

  try {
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${nearest_town},${state},US&limit=5&appid=${API_KEY}`;
    const res = await axios.get(url);

    if (!res.data || res.data.length === 0) {
      return { error: "No data found" };
    }

    const city = res.data[0];

    return {
      lat: city.lat,
      lon: city.lon,
    };
  } catch (err) {
    console.error(err);
    return { error: "Failed to retrieve latitude and longitude" };
  }
}

// Controller: get lakes
async function getLakes(req, res) {
  const { lake_id, state, county, nearest_town, name } = req.query;

  try {
    if (lake_id) {
      const lake = await Lake.findByPk(lake_id);
      if (!lake) return res.status(404).json({ error: "Lake not found" });
      return res.status(200).json(lake);
    }

    // No lake_id - filter lakes
    const whereClause = {};
    if (state) whereClause.state = state;
    if (county) whereClause.county = county;
    if (nearest_town) whereClause.nearest_town = nearest_town;
    if (name) whereClause.name = name;

    const lakes = await Lake.findAll({ where: whereClause });
    return res.status(200).json(lakes);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to retrieve lakes" });
  }
}

async function getLakeById(req, res) {
  try {
    const { lakeId } = req.params;

    const lake = await Lake.findByPk(lakeId);

    if (!lake) {
      return res.status(404).json({ error: "Lake not found" });
    }

    return res.status(200).json(lake);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to retrieve lake" });
  }
}

// Controller: add new lake
async function addLake(req, res) {
  try {
    const { name, state, nearest_town, county } = req.body;

    const coords = await getLakeLatLong(nearest_town, state);
    if (coords.error) {
      return res.status(400).json(coords);
    }

    const newLake = await Lake.create({
      name,
      state,
      nearest_town,
      county,
      latitude: coords.lat,
      longitude: coords.lon,
    });

    res.status(201).json(newLake);
  } catch (error) {
    console.error(error);
    if (
      error.name === "SequelizeUniqueConstraintError" ||
      error.name === "SequelizeValidationError"
    ) {
      return res
        .status(400)
        .json({ error: error.errors.map((e) => e.message) });
    }
    res.status(500).json({ error: "Server error" });
  }
}

// Controller: delete a lake
async function deleteLake(req, res) {
  try {
    const lakeId = req.params.lake_id;
    const lake = await Lake.findByPk(lakeId);

    if (!lake) {
      return res.status(404).json({ error: "Lake not found" });
    }

    await lake.destroy();
    res.status(200).json({ message: `${lake.name} deleted successfully` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete lake" });
  }
}

// Controller: update a lake
async function updateLake(req, res) {
  try {
    const lakeId = req.params.lake_id;
    const lake = await Lake.findByPk(lakeId);

    if (!lake) {
      return res.status(404).json({ error: "Lake not found" });
    }

    const { name, state, nearest_town, county, latitude, longitude } = req.body;

    // Update only provided fields
    if (name !== undefined) lake.name = name;
    if (state !== undefined) lake.state = state;
    if (nearest_town !== undefined) lake.nearest_town = nearest_town;
    if (county !== undefined) lake.county = county;
    if (latitude !== undefined) lake.latitude = latitude;
    if (longitude !== undefined) lake.longitude = longitude;

    await lake.save();

    res.status(200).json(lake);
  } catch (error) {
    console.error(error);
    if (error.name === "SequelizeValidationError") {
      return res
        .status(400)
        .json({ error: error.errors.map((e) => e.message) });
    }
    res.status(500).json({ error: "Failed to update lake" });
  }
}

module.exports = {
  getLakes,
  getLakeById,
  addLake,
  deleteLake,
  updateLake,
};
