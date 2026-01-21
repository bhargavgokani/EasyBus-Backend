const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middlewares/auth");
const seatController = require("../controllers/seatController");

// Public: view seat map for a schedule
router.get("/:scheduleId", seatController.getSeats);

// Authenticated: block seats
router.post("/block", requireAuth, seatController.blockSeats);

module.exports = router;

