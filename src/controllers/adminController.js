const adminService = require("../services/adminService");

async function addCity(req, res) {
  const { name } = req.body || {};
  const city = await adminService.addCity({ name });
  return res.status(201).json({ success: true, city });
}

async function getCities(req, res) {
  const cities = await adminService.getCities();
  return res.json({ success: true, cities });
}


async function addBus(req, res) {
  const { name, number, type, totalSeats } = req.body || {};
  const bus = await adminService.addBus({
    name,
    number,
    type,
    totalSeats,
  });
  return res.status(201).json({ success: true, bus });
}

async function getBuses(req, res) {
  const buses = await adminService.getBuses();
  return res.status(200).json({ success: true, buses });
}


async function addRoute(req, res) {
  const { sourceCityId, destinationId } = req.body || {};
  const route = await adminService.addRoute({ sourceCityId, destinationId });
  return res.status(201).json({ success: true, route });
}

async function getRoutes(req, res) {
  const routes = await adminService.getRoutes();
  return res.json({ success: true, routes });
}


async function createSchedule(req, res) {
  const { busId, routeId, travelDate, departureTime, arrivalTime, price } = req.body || {};
  const schedule = await adminService.createSchedule({
    busId,
    routeId,
    travelDate,
    departureTime,
    arrivalTime,
    price,
  });
  return res.status(201).json({ success: true, schedule });
}

async function viewBookings(req, res) {
  const bookings = await adminService.viewAllBookings();
  return res.status(200).json({ success: true, bookings });
}

async function getDashboardStats(req, res) {
  const stats = await adminService.getDashboardStats();
  return res.status(200).json(stats);
}

module.exports = {
  addCity,
  getCities,
  addBus,
  getBuses,
  getRoutes,
  addRoute,
  createSchedule,
  viewBookings,
  getDashboardStats,
};

