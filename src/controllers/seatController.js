const seatService = require("../services/seatService");

async function getSeats(req, res) {
  const { scheduleId } = req.params;
  const data = await seatService.getSeatsForSchedule(scheduleId);
  return res.status(200).json({ success: true, data });
}

async function blockSeats(req, res) {
  const { scheduleId, seatLabels } = req.body || {};
  const userId = req.user?.id;

  const result = await seatService.blockSeatsForUser({
    userId,
    scheduleId,
    seatLabels,
  });

  return res.status(200).json({
    success: true,
    message: "Seats blocked successfully",
    ...result,
  });
}

module.exports = { getSeats, blockSeats };

