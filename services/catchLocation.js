const { publicError } = require("../helpers/errors");
const fields = ["latitude", "longitude", "accuracy_meters", "captured_at", "source"];

function parseLocation(value) {
  if (typeof value === "string") {
    try { value = JSON.parse(value); }
    catch { throw publicError(400, "Invalid catch location."); }
  }
  if (value == null) return null;
  const invalid = () => { throw publicError(400, "Enter valid catch coordinates and location details."); };
  if (typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) invalid();
  if (typeof value.latitude !== "number" || !Number.isFinite(value.latitude) || Math.abs(value.latitude) > 90 ||
      typeof value.longitude !== "number" || !Number.isFinite(value.longitude) || Math.abs(value.longitude) > 180) invalid();
  if (!["manual", "device"].includes(value.source)) invalid();
  const accuracy = value.accuracy_meters ?? null;
  if (accuracy !== null && (typeof accuracy !== "number" || !Number.isFinite(accuracy) || accuracy < 0)) invalid();
  const captured = value.captured_at ?? null;
  if (captured !== null && (typeof captured !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(captured) || !Number.isFinite(Date.parse(captured)) || new Date(captured).toISOString().slice(0, 19) !== captured.slice(0, 19))) invalid();
  if (value.source === "device" && (accuracy === null || captured === null)) invalid();
  return { latitude: value.latitude, longitude: value.longitude, source: value.source,
    accuracy_meters: value.source === "manual" ? null : accuracy,
    captured_at: value.source === "manual" ? null : captured };
}
function serializeLocation(record) {
  if (!record) return null;
  return Object.fromEntries(fields.map(key => [key, record[key]]));
}
module.exports = { parseLocation, serializeLocation };
