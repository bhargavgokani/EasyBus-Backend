const express = require("express");
const router = express.Router();

const busController = require("../controllers/busController");

// User-facing search: /buses/search?sourceCityId=..&destinationId=..&travelDate=YYYY-MM-DD&page=&limit=
router.get("/search", busController.search);

module.exports = router;

    