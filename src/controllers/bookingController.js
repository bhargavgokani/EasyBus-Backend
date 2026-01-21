const bookingService = require("../services/bookingService");

async function confirm(req, res) {
  const { scheduleId, passengers } = req.body || {};
  const userId = req.user?.id;

  const result = await bookingService.confirmBooking({
    userId,
    scheduleId,
    passengers,
  });

  return res.status(201).json({
    success: true,
    message: "Booking confirmed",
    ...result,
  });
}

module.exports = { confirm };

