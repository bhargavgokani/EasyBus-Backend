const { ApiError } = require("../utils/ApiError");
const { verifyAccessToken } = require("../utils/jwt");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new ApiError(401, "Missing or invalid Authorization header");
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    };
    return next();
  } catch (e) {
    throw new ApiError(401, "Invalid or expired token");
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    if (req.user.role !== role) throw new ApiError(403, "Forbidden");
    return next();
  };
}

module.exports = { requireAuth, requireRole };

