const { publicError } = require("../helpers/errors");

function exportFilters(query) {
  if (Object.keys(query).some(key => !["lake_id", "species_id", "from", "to", "details"].includes(key)))
    throw publicError(400, "Unsupported export filter.");
  const filters = { details: true };
  for (const key of ["lake_id", "species_id"]) {
    if (query[key] === undefined) continue;
    if (typeof query[key] !== "string" || !/^[1-9]\d*$/.test(query[key]) || !Number.isSafeInteger(Number(query[key])))
      throw publicError(400, "Choose a valid lake or species.");
    filters[key] = Number(query[key]);
  }
  for (const key of ["from", "to"]) {
    if (query[key] === undefined) continue;
    const value = query[key];
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value)
      throw publicError(400, "Choose valid export dates.");
    filters[key] = value;
  }
  if (filters.from && filters.to && filters.from > filters.to)
    throw publicError(400, "The end date must be on or after the start date.");
  if (query.details !== undefined) {
    if (!["true", "false"].includes(query.details)) throw publicError(400, "Choose whether to include catch details.");
    filters.details = query.details === "true";
  }
  return filters;
}

function escapeXml(value) {
  // XML 1.0 disallows control characters and isolated UTF-16 surrogates.
  return String(value ?? "").replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function waypoint(fish, location, details) {
  if (!location || typeof location.latitude !== "number" || !Number.isFinite(location.latitude) || Math.abs(location.latitude) > 90 ||
      typeof location.longitude !== "number" || !Number.isFinite(location.longitude) || Math.abs(location.longitude) > 180) return null;
  // GPX longitude is [-180, 180); decimal syntax must not use exponent notation.
  const latitude = Number(location.latitude.toFixed(8)).toFixed(8);
  let longitude = Number(location.longitude.toFixed(8));
  if (longitude === 180) longitude = -180;
  const name = details ? [fish.species?.name || "Catch", fish.date, `#${fish.id}`].filter(Boolean).join(" ") : `Catch ${fish.id}`;
  const parts = [`  <wpt lat="${latitude}" lon="${longitude.toFixed(8)}">`];
  if (details && Number.isFinite(fish.timestamp) && Number.isFinite(new Date(fish.timestamp * 1000).getTime()))
    parts.push(`    <time>${new Date(fish.timestamp * 1000).toISOString()}</time>`);
  parts.push(`    <name>${escapeXml(name)}</name>`);
  if (details) {
    const description = [
      fish.lake?.name ? `Lake: ${fish.lake.name}` : null,
      fish.date ? `Catch date: ${fish.date}${fish.time ? ` ${fish.time}` : ""}` : null,
      Number.isFinite(fish.length) ? `Length: ${fish.length} in` : null,
      Number.isFinite(fish.weight) ? `Weight: ${fish.weight} lb` : null,
      fish.lure ? `Lure: ${[fish.lure.brand, fish.lure.name, fish.lure.color, fish.lure.size].filter(Boolean).join(" · ")}` : null,
    ].filter(Boolean).join("; ");
    if (description) parts.push(`    <desc>${escapeXml(description)}</desc>`);
  }
  parts.push("  </wpt>");
  return parts.join("\n");
}
function gpxDocument(waypoints, exported, skipped) {
  return ['<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Anglers Index" xmlns="http://www.topografix.com/GPX/1/1">',
    '  <metadata>', '    <name>Anglers Index catch locations</name>',
    `    <desc>${exported} catch locations exported; ${skipped} catches skipped without usable coordinates.</desc>`,
    '  </metadata>', ...waypoints, '</gpx>', ''].join("\n");
}
module.exports = { exportFilters, escapeXml, waypoint, gpxDocument };
