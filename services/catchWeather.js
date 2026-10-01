const axios = require("axios");

const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
function number(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function mapWeather(observation) {
  if (!observation || typeof observation !== "object") throw new Error("Weather observation missing");
  const temperature = number(observation.temp);
  const pressure = number(observation.pressure);
  const speed = number(observation.wind_speed);
  const degrees = number(observation.wind_deg);
  const conditions = Array.isArray(observation.weather)
    ? observation.weather.map(item => item?.description || item?.main).filter(value => typeof value === "string" && value.trim()).join(", ")
    : "";
  const fields = {
    temperature: temperature == null ? null : Math.round(temperature),
    barometric: pressure == null || pressure <= 0 ? null : Math.round(pressure * 0.0295299830714 * 100) / 100,
    wind_speed: speed == null || speed < 0 ? null : Math.round(speed),
    // The existing database field supports two characters, so use eight compass points.
    wind_direction: degrees == null || degrees < 0 || degrees > 360 ? null : directions[Math.round(degrees / 45) % 8],
    weather_conditions: conditions || null,
  };
  if (Object.values(fields).every(value => value == null)) throw new Error("Weather observation empty");
  return fields;
}

async function getCatchWeather(lake, timestamp) {
  const latitude = number(lake?.latitude);
  const longitude = number(lake?.longitude);
  if (latitude == null || longitude == null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
    throw new Error("Lake coordinates unavailable");
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) throw new Error("Weather API key unavailable");
  const response = await axios.get("https://api.openweathermap.org/data/3.0/onecall/timemachine", {
    params: { lat: latitude, lon: longitude, dt: timestamp, appid: apiKey, units: "imperial" },
    timeout: 5000,
  });
  return mapWeather(response.data?.data?.[0]);
}

module.exports = { getCatchWeather, mapWeather };
