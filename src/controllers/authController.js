const authService = require("../services/authService");

async function register(req, res) {
  const { email, password } = req.body || {};
  const result = await authService.register({ email, password });
  return res.status(201).json({ success: true, ...result });
}

async function login(req, res) {
  const { email, password } = req.body || {};
  const result = await authService.login({ email, password });
  return res.status(200).json({ success: true, ...result });
}

module.exports = { register, login };

