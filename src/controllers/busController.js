const busService = require("../services/busService");

async function search(req, res) {
  const { sourceCityId, destinationId, travelDate, page, limit } = req.query || {};

  const data = await busService.searchBuses({
    sourceCityId,
    destinationId,
    travelDate,
    page,
    limit,
  });

  return res.status(200).json({ success: true, ...data });
}

module.exports = { search };

