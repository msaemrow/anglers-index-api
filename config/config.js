require("dotenv").config();

module.exports = {
  development: {
    url: process.env.DB_STRING,
    dialect: "postgres",
    logging: false,
  },
  test: {
    url: process.env.DB_STRING_TEST || process.env.DB_STRING,
    dialect: "postgres",
    logging: false,
  },
  production: {
    url: process.env.DB_STRING,
    dialect: "postgres",
    logging: false,
  },
};
