const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middlewares/auth");
const adminController = require("../controllers/adminController");

// All admin routes require ADMIN role
router.use(requireAuth, requireRole("ADMIN"));

router.post("/cities", adminController.addCity);
router.post("/buses", adminController.addBus);
router.post("/routes", adminController.addRoute);
router.post("/schedules", adminController.createSchedule);
router.get("/bookings", adminController.viewBookings);
router.get("/dashboard", adminController.getDashboardStats);

module.exports = router;

