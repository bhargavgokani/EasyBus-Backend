const userService = require("../services/userService");

async function getCities(req, res) {
  const cities = await userService.getCities();
  return res.status(200).json({
    success: true,
    cities,
  });
}

module.exports = {
  getCities,
};
