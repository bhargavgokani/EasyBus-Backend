const { prisma } = require("../prisma/client");
const { ApiError } = require("../utils/ApiError");

/**
 * Search bus schedules for a given route (sourceCityId, destinationId) and travelDate.
 * - Only returns schedules with at least one AVAILABLE seat.
 * - Counts AVAILABLE seats using a single grouped query for efficiency.
 * - Orders by departureTime ascending.
 * - Supports pagination via page & limit.
 */
async function searchBuses({ sourceCityId, destinationId, travelDate, page = 1, limit = 10 }) {
  sourceCityId = Number(sourceCityId);
  destinationId = Number(destinationId);
  page = Number(page) || 1;
  limit = Number(limit) || 10;

  if (!sourceCityId || !destinationId || !travelDate) {
    throw new ApiError(400, "sourceCityId, destinationId and travelDate are required");
  }
  if (page < 1) page = 1;
  if (limit < 1 || limit > 100) limit = 10;

  const travelDateObj = new Date(travelDate);
  if (Number.isNaN(travelDateObj.getTime())) {
    throw new ApiError(400, "Invalid travelDate; expected YYYY-MM-DD");
  }

  // Step 1: resolve the route by (sourceCityId, destinationId)
  const route = await prisma.route.findUnique({
    where: {
      sourceCityId_destinationId: {
        sourceCityId,
        destinationId,
      },
    },
  });

  if (!route) {
    // No such route; return empty, not an error
    return { page, limit, total: 0, results: [] };
  }

  // Step 2: find matching schedules for that route + travelDate
  // Using travelDate as a Date (Postgres DATE), equality is safe.
  const skip = (page - 1) * limit;

  const [schedules, totalCount] = await Promise.all([
    prisma.busSchedule.findMany({
      where: {
        routeId: route.id,
        travelDate: travelDateObj,
      },
      orderBy: { departureTime: "asc" },
      include: {
        bus: true,
      },
      skip,
      take: limit,
    }),
    prisma.busSchedule.count({
      where: {
        routeId: route.id,
        travelDate: travelDateObj,
      },
    }),
  ]);

  if (schedules.length === 0) {
    return { page, limit, total: 0, results: [] };
  }

  const scheduleIds = schedules.map((s) => s.id);

  // Step 3: count AVAILABLE seats per schedule using groupBy on SeatAvailability
  const availabilityCounts = await prisma.seatAvailability.groupBy({
    by: ["scheduleId"],
    where: {
      scheduleId: { in: scheduleIds },
      status: "AVAILABLE",
    },
    _count: {
      _all: true,
    },
  });

  const availableCountByScheduleId = new Map(
    availabilityCounts.map((row) => [row.scheduleId, row._count._all])
  );

  // Step 4: map schedules to DTOs, filter out those with zero available seats
  const results = schedules
    .map((s) => {
      const availableSeats = availableCountByScheduleId.get(s.id) || 0;
      return {
        scheduleId: s.id,
        busId: s.busId,
        busName: s.bus.name,
        busType: s.bus.type,
        routeId: s.routeId,
        travelDate: s.travelDate,
        departureTime: s.departureTime,
        arrivalTime: s.arrivalTime,
        price: s.price,
        availableSeats,
      };
    })
    .filter((r) => r.availableSeats > 0);

  return {
    page,
    limit,
    total: results.length, // total for this page after excluding zero-availability schedules
    results,
  };
}

module.exports = { searchBuses };

