const express = require("express");
const router = express.Router();

const userController = require("../controllers/userController");
const { requireAuth } = require("../middlewares/auth");

// User protected routes
router.use(requireAuth);

// Cities for users (search, dropdowns, filters)
router.get("/cities", userController.getCities);

module.exports = router;
