const jwt = require("jsonwebtoken");
const { ApiError } = require("./ApiError");

function signAccessToken(payload) {
  if (!process.env.JWT_SECRET) {
    throw new ApiError(500, "Server misconfigured: JWT_SECRET is missing");
  }

  // Keeping expiry simple; can be made configurable later.
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function verifyAccessToken(token) {
  if (!process.env.JWT_SECRET) {
    throw new ApiError(500, "Server misconfigured: JWT_SECRET is missing");
  }
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signAccessToken, verifyAccessToken };

