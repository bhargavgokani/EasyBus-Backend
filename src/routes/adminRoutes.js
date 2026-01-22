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
router.get("/cities", adminController.getCities);
router.get("/routes", adminController.getRoutes);  
router.get("/buses", adminController.getBuses);
router.get("/schedules", adminController.getSchedules);

module.exports = router;

