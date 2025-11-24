// swagger/schemas.js

const lakeSchema = {
  type: "object",
  properties: {
    id: { type: "integer", example: 1 },
    name: { type: "string", example: "Lake Michigan" },
    state: { type: "string", example: "WI" },
    county: { type: "string", example: "Milwaukee" },
    nearest_town: { type: "string", example: "Milwaukee" },
    latitude: { type: "number", format: "float", example: 43.0389 },
    longitude: { type: "number", format: "float", example: -87.9065 },
    createdAt: {
      type: "string",
      format: "date-time",
      example: "2023-01-01T12:00:00Z",
    },
    updatedAt: {
      type: "string",
      format: "date-time",
      example: "2023-01-02T12:00:00Z",
    },
  },
  required: [
    "name",
    "state",
    "nearest_town",
    "county",
    "latitude",
    "longitude",
  ],
};

const lureSchema = {
  type: "object",
  properties: {
    id: { type: "integer", example: 11 },
    userId: { type: "integer", example: 7 },
    name: { type: "string", example: "Super Lure" },
    brand: { type: "string", example: "LureCo" },
    color: { type: "string", example: "Red" },
    size: { type: "string", example: "Medium" },
    createdAt: {
      type: "string",
      format: "date-time",
      example: "2023-01-10T08:00:00Z",
    },
    updatedAt: {
      type: "string",
      format: "date-time",
      example: "2023-01-15T08:00:00Z",
    },
  },
  required: ["userId", "name", "brand", "color", "size"],
};

const speciesSchema = {
  type: "object",
  properties: {
    id: { type: "integer", example: 5 },
    name: { type: "string", example: "Largemouth Bass" },
    master_angler_length: { type: "float", example: 17.0 },
    createdAt: {
      type: "string",
      format: "date-time",
      example: "2023-02-01T09:00:00Z",
    },
    updatedAt: {
      type: "string",
      format: "date-time",
      example: "2023-02-05T09:00:00Z",
    },
  },
  required: ["common_name", "scientific_name"],
};

const fishCatchSchema = {
  type: "object",
  properties: {
    id: { type: "integer", example: 42 },
    user_id: { type: "integer", example: 7 },
    lake_id: { type: "integer", example: 1 },
    species_id: { type: "integer", example: 5 },
    lure_id: { type: "integer", example: 11 },
    weight: { type: "number", example: 3.4 },
    length: { type: "number", example: 24.5 },
    date: { type: "string", format: "date", example: "2023-10-01" },
    time: { type: "string", format: "time", example: "14:30:00" },
    image: { type: "string", example: "/static/images/fish1.jpg" },
    master_angler: { type: "boolean", example: true },
    createdAt: {
      type: "string",
      format: "date-time",
      example: "2023-10-02T12:00:00Z",
    },
    updatedAt: {
      type: "string",
      format: "date-time",
      example: "2023-10-02T12:00:00Z",
    },

    // Optionally include nested objects for relations (if you populate them)
    lake: { $ref: "#/components/schemas/Lake" },
    lure: { $ref: "#/components/schemas/Lure" },
    species: { $ref: "#/components/schemas/Species" },
  },
  required: [
    "user_id",
    "lake_id",
    "species_id",
    "lure_id",
    "weight",
    "length",
    "date",
    "time",
  ],
};

const masterAnglerSchema = {
  type: "object",
  properties: {
    id: { type: "integer", example: 101 },
    user_id: { type: "integer", example: 7 },
    catch_id: { type: "integer", example: 42 },
    reviewed: { type: "boolean", example: false },

    createdAt: {
      type: "string",
      format: "date-time",
      example: "2024-01-15T14:22:10Z",
    },
    updatedAt: {
      type: "string",
      format: "date-time",
      example: "2024-01-15T14:22:10Z",
    },

    // Populated relationships (only included on GET endpoints)
    user: {
      $ref: "#/components/schemas/User",
      nullable: true,
    },
    catch: {
      $ref: "#/components/schemas/FishCatch",
      nullable: true,
    },
  },

  required: ["user_id", "catch_id"],
};

module.exports = {
  lakeSchema,
  lureSchema,
  speciesSchema,
  fishCatchSchema,
  masterAnglerSchema,
};
