const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middlewares/auth");
const bookingController = require("../controllers/bookingController");

// Confirm booking for blocked seats
router.post("/confirm", requireAuth, bookingController.confirm);
router.get("/my", requireAuth, bookingController.getMyBookings);

module.exports = router;

