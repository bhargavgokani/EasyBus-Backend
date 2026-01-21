const { prisma } = require("../prisma/client");
const { ApiError } = require("../utils/ApiError");
const { hashPassword, verifyPassword } = require("../utils/password");
const { signAccessToken } = require("../utils/jwt");
const { isValidEmail, isStrongEnoughPassword } = require("../utils/validators");

async function register({ email, password }) {
  if (!isValidEmail(email)) throw new ApiError(400, "Invalid email");
  if (!isStrongEnoughPassword(password))
    throw new ApiError(400, "Password must be at least 8 characters");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ApiError(409, "Email already registered");

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, password: passwordHash, role: "USER" },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  const token = signAccessToken({ userId: user.id, role: user.role, email: user.email });
  return { user, token };
}

async function login({ email, password }) {
  if (!isValidEmail(email)) throw new ApiError(400, "Invalid email");
  if (typeof password !== "string" || password.length === 0)
    throw new ApiError(400, "Password is required");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new ApiError(401, "Invalid credentials");

  const ok = await verifyPassword(password, user.password);
  if (!ok) throw new ApiError(401, "Invalid credentials");

  const token = signAccessToken({ userId: user.id, role: user.role, email: user.email });
  return {
    user: { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt },
    token,
  };
}

module.exports = { register, login };

