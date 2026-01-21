const { prisma } = require("../prisma/client");
const { ApiError } = require("../utils/ApiError");

function normalizeCityName(name) {
  return String(name || "").trim();
}

function generateSeatLabels(totalSeats) {
  // Simple deterministic label generator: A1..A{N}
  // This matches your "A1, A2..." requirement and keeps labels stable.
  const labels = [];
  for (let i = 1; i <= totalSeats; i += 1) {
    labels.push(`A${i}`);
  }
  return labels;
}

async function addCity({ name }) {
  const cityName = normalizeCityName(name);
  if (!cityName) throw new ApiError(400, "City name is required");

  try {
    return await prisma.city.create({ data: { name: cityName } });
  } catch (e) {
    // Prisma unique constraint => city already exists
    throw new ApiError(409, "City already exists");
  }
}

async function addBus({ name, number, type, totalSeats }) {
  if (!name || typeof name !== "string") throw new ApiError(400, "Bus name is required");
  if (!number || typeof number !== "string") throw new ApiError(400, "Bus number is required");
  if (!type || typeof type !== "string") throw new ApiError(400, "Bus type is required");
  if (typeof totalSeats !== "number" || totalSeats <= 0)
    throw new ApiError(400, "totalSeats must be a positive number");

  const seatLabels = generateSeatLabels(totalSeats);

  return await prisma.$transaction(async (tx) => {
    // Ensure bus number uniqueness (gives clearer error than generic 500)
    const existing = await tx.bus.findUnique({ where: { number } });
    if (existing) throw new ApiError(409, "Bus with this number already exists");

    const bus = await tx.bus.create({
      data: {
        name,
        number,
        type,
        totalSeats,
      },
    });

    // Create all seats for this bus
    await tx.seat.createMany({
      data: seatLabels.map((label) => ({
        busId: bus.id,
        label,
      })),
    });

    return bus;
  });
}

async function addRoute({ sourceCityId, destinationId }) {
  sourceCityId = Number(sourceCityId);
  destinationId = Number(destinationId);

  if (!sourceCityId || !destinationId) {
    throw new ApiError(400, "sourceCityId and destinationId are required");
  }
  if (sourceCityId === destinationId) {
    throw new ApiError(400, "sourceCityId and destinationId cannot be the same");
  }

  // Validate both cities exist
  const [src, dst] = await Promise.all([
    prisma.city.findUnique({ where: { id: sourceCityId } }),
    prisma.city.findUnique({ where: { id: destinationId } }),
  ]);
  if (!src) throw new ApiError(404, "Source city not found");
  if (!dst) throw new ApiError(404, "Destination city not found");

  try {
    return await prisma.route.create({
      data: { sourceCityId, destinationId },
    });
  } catch (e) {
    throw new ApiError(409, "Route already exists");
  }
}

async function createSchedule({
  busId,
  routeId,
  travelDate,
  departureTime,
  arrivalTime,
  price,
}) {
  busId = Number(busId);
  routeId = Number(routeId);
  price = Number(price);

  if (!busId || !routeId) throw new ApiError(400, "busId and routeId are required");
  if (!travelDate) throw new ApiError(400, "travelDate is required (YYYY-MM-DD)");
  if (!departureTime) throw new ApiError(400, "departureTime is required (ISO datetime)");
  if (!arrivalTime) throw new ApiError(400, "arrivalTime is required (ISO datetime)");
  if (!Number.isFinite(price) || price <= 0) throw new ApiError(400, "price must be > 0");

  const travelDateObj = new Date(travelDate);
  const departureObj = new Date(departureTime);
  const arrivalObj = new Date(arrivalTime);

  if (Number.isNaN(travelDateObj.getTime())) throw new ApiError(400, "Invalid travelDate");
  if (Number.isNaN(departureObj.getTime())) throw new ApiError(400, "Invalid departureTime");
  if (Number.isNaN(arrivalObj.getTime())) throw new ApiError(400, "Invalid arrivalTime");
  if (arrivalObj <= departureObj)
    throw new ApiError(400, "arrivalTime must be after departureTime");

  return await prisma.$transaction(async (tx) => {
    const bus = await tx.bus.findUnique({
      where: { id: busId },
      include: { seats: true },
    });
    if (!bus) throw new ApiError(404, "Bus not found");

    const route = await tx.route.findUnique({ where: { id: routeId } });
    if (!route) throw new ApiError(404, "Route not found");

    const schedule = await tx.busSchedule.create({
      data: {
        busId,
        routeId,
        travelDate: travelDateObj,
        departureTime: departureObj,
        arrivalTime: arrivalObj,
        price,
      },
    });

    // Auto-generate seat availability for all seats on this bus for this schedule
    if (!bus.seats || bus.seats.length === 0) {
      throw new ApiError(500, "Bus has no seats initialized");
    }

    await tx.seatAvailability.createMany({
      data: bus.seats.map((s) => ({
        scheduleId: schedule.id,
        seatId: s.id,
        status: "AVAILABLE",
      })),
      skipDuplicates: true,
    });

    return schedule;
  });
}

async function viewAllBookings() {
  return await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, email: true, role: true } },
      schedule: {
        include: {
          bus: true,
          route: {
            include: {
              sourceCity: true,
              destinationCity: true,
            },
          },
        },
      },
      passengers: true,
      payment: true,
      seatAvailabilities: {
        include: { seat: true },
      },
    },
  });
}

module.exports = {
  addCity,
  addBus,
  addRoute,
  createSchedule,
  viewAllBookings,
};

