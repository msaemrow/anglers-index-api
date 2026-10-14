// controllers/fishCatchController.js

const { FishCatch, Lake, Lure, Species, MasterAngler, Trip, sequelize } = require("../models");
const { awardFields, serializeAward, DENIAL_REASONS } = require("../services/masterAnglerReview");
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
      { model: MasterAngler, as: "masterAnglerEntries", attributes: ["status"], separate: true, limit: 1, order: [["id", "DESC"]] },
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
      const approved = masterAngler === "Y" || masterAngler === "true";
      // Award filtering follows the review decision, including older denied catches.
      const submissions = await MasterAngler.findAll({ where: { status: "approved" }, attributes: ["catch_id"], raw: true });
      whereClause[Op.and] = [{ id: { [approved ? Op.in : Op.notIn]: submissions.map(s => s.catch_id) } }];
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

    return res.status(200).json(catches.map(serializeAward));
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

    const review = await MasterAngler.findOne({ where: { catch_id: catchObj.id }, order: [["id", "DESC"]] });
    return res.status(200).json({ ...catchObj.toJSON(), ...awardFields(catchObj, review), master_angler_review: review, master_angler_denial_reasons: DENIAL_REASONS });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createFishCatch = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized. Must be logged in." });
  let photoKey;
  let committed = false;
  try {
    const { lake_id, species_id, lure_id, weight, length, date, time, timestamp, fish_image, witness } = req.body;
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
    if (fish_image) return res.status(400).json({ error: "Upload a photo file instead of supplying a photo path." });
    const tripId = req.body.trip_id;
    const startingTrip = req.body.new_trip !== undefined;
    const tripRange = startingTrip && req.body.new_trip && typeof req.body.new_trip === "object" ? require("../services/trips").tripDates(req.body.new_trip) : null;
    if (tripId != null && (!Number.isSafeInteger(Number(tripId)) || Number(tripId) <= 0))
      return res.status(400).json({ error: "Choose a valid fishing trip." });
    if (startingTrip && (tripId != null || !tripRange || date < tripRange.start_date || date > tripRange.end_date))
      return res.status(400).json({ error: "Choose valid trip dates that include the catch date. Choose an existing trip or start a new one." });
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
    let review;
    const newCatch = await sequelize.transaction(async transaction => {
    let assignedTripId = tripId == null ? null : Number(tripId);
    if (startingTrip) {
      const trip = await Trip.create({ user_id: req.user.id, lake_id: Number(lake_id), ...tripRange, notes: "" }, { transaction });
      assignedTripId = trip.id;
    }
    if (tripId != null) {
      const trip = await Trip.findOne({ where: { id: Number(tripId), user_id: req.user.id }, transaction, lock: transaction.LOCK.UPDATE });
      const error = require("../services/trips").tripCatchError(trip, { lake_id, date }, req.user.id);
      if (error) throw Object.assign(new Error(error), { status: 400 });
    }
    if (req.photoBuffer) photoKey = await require("../services/catchPhotos").storePhoto(req.photoBuffer);
    const fish = await FishCatch.create({
      user_id: req.user.id,
      trip_id: assignedTripId,
      lake_id: Number(lake_id), species_id: Number(species_id), lure_id: Number(lure_id),
      weight: Number(weight), length: Number(length), date, time,
      timestamp: catchTimestamp,
      ...weather,
      witness: typeof witness === "string" ? witness.trim().slice(0, 75) : "NA",
      fish_image: photoKey || "",
    }, { transaction });
    review = await require("../services/masterAnglerReview").syncSubmission(fish, transaction);
    return fish;
    });
    committed = true;
    const result = { ...newCatch.toJSON(), ...awardFields(newCatch, review), master_angler_review: review };
    if (weatherWarning) result.weather_warning = weatherWarning;
    return res.status(201).json(result);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.status ? err.message : "Unable to save this catch." });
  } finally {
    if (photoKey && !committed) await require("../services/catchPhotos").removePhoto(photoKey);
  }
};

const updateFishCatch = async (req, res) => {
  try {
    const { catch_id } = req.params;
    const allowed = ["species_id", "lake_id", "lure_id", "length", "weight", "date", "time", "timestamp", "witness"];
    if (Object.keys(req.body).some(key => !allowed.includes(key)))
      return res.status(400).json({ error: "Unsupported catch field. Award decisions require an admin review." });
    const result = await sequelize.transaction(async transaction => {
      const catchObj = await FishCatch.findByPk(catch_id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!catchObj) return { code: 404, error: "Fish catch not found." };
      if (String(catchObj.user_id) !== String(req.user.id) && !req.user.is_admin)
        return { code: 403, error: "You can only edit your own catches." };
      for (const field of ["length", "weight"]) {
        if (req.body[field] !== undefined && (req.body[field] === null || String(req.body[field]).trim() === "" || !Number.isFinite(Number(req.body[field])) || Number(req.body[field]) < 0))
          return { code: 400, error: "Length and weight must be nonnegative numbers." };
      }
      if (req.body.witness !== undefined && (typeof req.body.witness !== "string" || req.body.witness.length > 75))
        return { code: 400, error: "Witness must be a name of at most 75 characters." };
      if (!Object.keys(req.body).length) {
        const review = await MasterAngler.findOne({ where: { catch_id: catchObj.id }, transaction });
        return { fish: catchObj, review };
      }
      if (catchObj.trip_id != null && ["lake_id", "date"].some(field => req.body[field] !== undefined && String(req.body[field]) !== String(catchObj[field])))
        return { code: 400, error: "Lake and date cannot be changed while a catch belongs to a trip." };
      await catchObj.update(req.body, { transaction });
      const review = await require("../services/masterAnglerReview").syncSubmission(catchObj, transaction);
      return { fish: catchObj, review };
    });
    if (result.error) return res.status(result.code).json({ error: result.error });
    return res.json({ ...result.fish.toJSON(), ...awardFields(result.fish, result.review), master_angler_review: result.review });
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

    if (String(catchObj.user_id) !== String(req.user.id) && !req.user.is_admin)
      return res.status(403).json({ error: "You can only delete your own catches." });
    await catchObj.destroy();
    await require("../services/catchPhotos").removePhoto(catchObj.fish_image);

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
