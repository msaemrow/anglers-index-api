require("dotenv").config();
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(process.env.DB_STRING, {
  dialect: "postgres",
  logging: false,
});

// Import models
const User = require("./User")(sequelize);
const FishCatch = require("./FishCatch")(sequelize);
const Lake = require("./Lake")(sequelize);
const Lure = require("./Lure")(sequelize);
const Species = require("./Species")(sequelize);
const MasterAngler = require("./MasterAngler")(sequelize);
const TackleBox = require("./TackleBox")(sequelize);

// User - FishCatch
User.hasMany(FishCatch, { foreignKey: "user_id", as: "fishCatches" });
FishCatch.belongsTo(User, { foreignKey: "user_id", as: "user" });

// Lake - FishCatch
Lake.hasMany(FishCatch, { foreignKey: "lake_id", as: "fishCatches" });
FishCatch.belongsTo(Lake, { foreignKey: "lake_id", as: "lake" });

// Species - FishCatch
Species.hasMany(FishCatch, { foreignKey: "species_id", as: "fishCatches" });
FishCatch.belongsTo(Species, { foreignKey: "species_id", as: "species" });

// Lure - FishCatch
Lure.hasMany(FishCatch, { foreignKey: "lure_id", as: "fishCatches" });
FishCatch.belongsTo(Lure, { foreignKey: "lure_id", as: "lure" });

// User - Lure (each lure belongs to a user)
User.hasMany(Lure, { foreignKey: "user_id", as: "lures" });
Lure.belongsTo(User, { foreignKey: "user_id", as: "owner" });

// User - TackleBox (a user has many tackle box entries)
User.hasMany(TackleBox, { foreignKey: "user_id", as: "tackleBoxEntries" });
TackleBox.belongsTo(User, { foreignKey: "user_id", as: "user" });

// Lure - TackleBox (a lure can be in many tackle boxes)
Lure.hasMany(TackleBox, { foreignKey: "lure_id", as: "tackleBoxEntries" });
TackleBox.belongsTo(Lure, { foreignKey: "lure_id", as: "lure" });

// User - MasterAngler (a user can have many master angler catches)
User.hasMany(MasterAngler, {
  foreignKey: "user_id",
  as: "masterAnglerCatches",
});
MasterAngler.belongsTo(User, { foreignKey: "user_id", as: "user" });

// FishCatch - MasterAngler (a fish catch can have many master angler entries)
FishCatch.hasMany(MasterAngler, {
  foreignKey: "catch_id",
  as: "masterAnglerEntries",
});
MasterAngler.belongsTo(FishCatch, { foreignKey: "catch_id", as: "catch" });

module.exports = {
  sequelize,
  connectDb: async () => {
    try {
      await sequelize.authenticate();
      console.log("💾 Database connected successfully!");
      // await sequelize.sync({ alter: true }); // optional syncing
    } catch (err) {
      console.error("❌ Database connection failed:", err);
      process.exit(1);
    }
  },
  User,
  FishCatch,
  Lake,
  Lure,
  Species,
  MasterAngler,
  TackleBox,
};
