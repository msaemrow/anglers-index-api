const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const {
  lakeSchema,
  lureSchema,
  speciesSchema,
  fishCatchSchema,
  masterAnglerSchema,
} = require("./schemas"); // import your schema definitions

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Reel Report API",
      version: "1.0.0",
      description: "API documentation for Reel Report",
    },
    servers: [
      {
        url: "http://localhost:3000",
      },
    ],
    components: {
      schemas: {
        Lake: lakeSchema,
        Lure: lureSchema,
        Species: speciesSchema,
        FishCatch: fishCatchSchema,
        MasterAngler: masterAnglerSchema,
      },
    },
  },
  apis: ["./routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = { swaggerSpec, swaggerUi };
