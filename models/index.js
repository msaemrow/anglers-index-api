require("dotenv").config();
("use strict");

const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");

const basename = path.basename(__filename);
const db = {};

// ---------------------------------------------
// 1️⃣ Create your Sequelize instance (using DB_STRING)
// ---------------------------------------------
const sequelize = new Sequelize(process.env.DB_STRING, {
  dialect: "postgres",
  logging: false,
});

// ---------------------------------------------
// 2️⃣ Import your models manually (your current structure)
// ---------------------------------------------
const User = require("./User")(sequelize);
const FishCatch = require("./FishCatch")(sequelize);
const Lake = require("./Lake")(sequelize);
const Lure = require("./Lure")(sequelize);
const Species = require("./Species")(sequelize);
const MasterAngler = require("./MasterAngler")(sequelize);
const TackleBox = require("./TackleBox")(sequelize);

// Store in db object so migrations can see them
db.User = User;
db.FishCatch = FishCatch;
db.Lake = Lake;
db.Lure = Lure;
db.Species = Species;
db.MasterAngler = MasterAngler;
db.TackleBox = TackleBox;

// ---------------------------------------------
// 3️⃣ Associations (same as your old file)
// ---------------------------------------------

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

// User - Lure
User.hasMany(Lure, { foreignKey: "user_id", as: "lures" });
Lure.belongsTo(User, { foreignKey: "user_id", as: "owner" });

// User - TackleBox
User.hasMany(TackleBox, { foreignKey: "user_id", as: "tackleBoxEntries" });
TackleBox.belongsTo(User, { foreignKey: "user_id", as: "user" });

// Lure - TackleBox
Lure.hasMany(TackleBox, { foreignKey: "lure_id", as: "tackleBoxEntries" });
TackleBox.belongsTo(Lure, { foreignKey: "lure_id", as: "lure" });

// User - MasterAngler
User.hasMany(MasterAngler, {
  foreignKey: "user_id",
  as: "masterAnglerCatches",
});
MasterAngler.belongsTo(User, { foreignKey: "user_id", as: "user" });

// FishCatch - MasterAngler
FishCatch.hasMany(MasterAngler, {
  foreignKey: "catch_id",
  as: "masterAnglerEntries",
});
MasterAngler.belongsTo(FishCatch, { foreignKey: "catch_id", as: "catch" });

// ---------------------------------------------
// 4️⃣ Export sequelize + Sequelize (required by CLI)
// ---------------------------------------------
db.sequelize = sequelize;
db.Sequelize = Sequelize;

// ---------------------------------------------
// 5️⃣ Add your connectDb helper
// ---------------------------------------------
db.connectDb = async () => {
  try {
    await sequelize.authenticate();
    console.log("💾 Database connected successfully!");
  } catch (err) {
    console.error("❌ Database connection failed:", err);
    process.exit(1);
  }
};

module.exports = db;
