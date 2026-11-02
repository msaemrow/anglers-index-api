const { User } = require("../models");
const { sendError } = require("../helpers/errors");
exports.preferences = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "PATCH" && (!req.body || Object.keys(req.body).length !== 1 || typeof req.body.capture_catch_location !== "boolean"))
      return res.status(400).json({ error: "Provide a boolean capture_catch_location preference." });
    const user = await User.findByPk(req.user.id, { attributes: ["id", "capture_catch_location"] });
    if (!user) return res.status(404).json({ error: "User not found." });
    if (req.method === "PATCH") await user.update({ capture_catch_location: req.body.capture_catch_location });
    return res.json({ capture_catch_location: user.capture_catch_location });
  } catch (error) { return sendError(res, error, req); }
};
