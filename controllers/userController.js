const { Op } = require("sequelize");
const { User, FishCatch, MasterAngler, Lure } = require("../models");
const createToken = require("../helpers/createToken");
const bcrypt = require("bcrypt");

exports.signup = async (req, res) => {
  const { username, first_name, last_name, password, email } = req.body;

  if (!username || !first_name || !last_name || !password || !email) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      return res.status(400).json({ error: "Username already exists." });
    }
    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({ error: "Email already exists." });
    }

    const newUser = await User.create({
      username,
      first_name,
      last_name,
      password,
      email,
    });

    const token = createToken(newUser);

    return res.status(201).json({
      message: "Signup successful",
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        email: newUser.email,
        is_admin: newUser.is_admin,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required." });
  }

  try {
    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const validPassword = await user.checkPassword(password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = createToken(user);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        is_admin: user.is_admin,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET /users? filters (id, username, email, first_name, last_name, is_admin)
exports.getAllUsers = async (req, res) => {
  const currentUser = req.user;

  if (!currentUser.is_admin) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Build filter conditions from query params
    const filters = {};
    const allowedFilters = [
      "id",
      "username",
      "email",
      "first_name",
      "last_name",
      "is_admin",
    ];

    allowedFilters.forEach((field) => {
      if (req.query[field] !== undefined) {
        if (field === "is_admin") {
          // Convert string to boolean
          filters[field] = req.query[field] === "true";
        } else if (field === "id") {
          filters[field] = Number(req.query[field]);
        } else {
          filters[field] = { [Op.iLike]: `%${req.query[field]}%` };
        }
      }
    });

    const users = await User.findAll({
      where: filters,
      attributes: { exclude: ["password"] },
    });

    return res.status(200).json(users);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getUserById = async (req, res) => {
  const { user_id } = req.params;
  const currentUser = req.user; // Assume req.user is set by auth middleware

  if (currentUser) {
    if (parseInt(user_id) !== currentUser.id && !currentUser.is_admin) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const user = await User.findByPk(user_id, {
      attributes: { exclude: ["password"] },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Fetch counts of related items
    const [fishCatchesCount, masterAnglerCount, luresCount] = await Promise.all(
      [
        FishCatch.count({ where: { user_id } }),
        MasterAngler.count({ where: { user_id } }),
        Lure.count({ where: { user_id } }),
      ]
    );

    // Compose response
    const userData = user.toJSON();
    userData.stats = {
      fish_catches_count: fishCatchesCount,
      master_angler_catches_count: masterAnglerCount,
      lures_count: luresCount,
    };

    return res.status(200).json(userData);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  const { user_id } = req.params;
  const currentUser = req.user;

  if (parseInt(user_id) !== currentUser.id) {
    return res
      .status(401)
      .json({ error: "Unauthorized. Cannot update other users' data" });
  }

  const { username, first_name, last_name, email } = req.body;

  try {
    const user = await User.findByPk(user_id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (username && username !== user.username) {
      const usernameExists = await User.findOne({ where: { username } });
      if (usernameExists) {
        return res.status(409).json({ error: "Username already taken" });
      }
      user.username = username;
    }

    if (first_name) user.first_name = first_name;
    if (last_name) user.last_name = last_name;
    if (email) user.email = email;

    await user.save();

    const userResponse = user.toJSON();
    delete userResponse.password;

    return res.status(200).json(userResponse);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  const { user_id } = req.params;
  const currentUser = req.user;

  if (parseInt(user_id) !== currentUser.id && !currentUser.is_admin) {
    return res
      .status(401)
      .json({ error: "Unauthorized. Cannot delete another user's account" });
  }

  try {
    const user = await User.findByPk(user_id);
    if (!user) return res.status(404).json({ error: "User not found" });

    await user.destroy();
    return res.status(200).json({ message: "Successfully deleted user" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
