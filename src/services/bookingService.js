const { prisma } = require("../prisma/client");
const { ApiError } = require("../utils/ApiError");

const MAX_SEATS_PER_BOOKING = 6;

/**
 * Booking confirmation flow:
 * - Validate payload (passengers, scheduleId, seat labels, max seats).
 * - Ensure all target seats are currently BLOCKED by this user and not expired.
 * - Convert those SeatAvailability rows: BLOCKED -> BOOKED, set bookingId, clear blockedBy/blockedUntil.
 * - Optionally release any other BLOCKED seats for this user on the same schedule.
 * - Create Booking, Passengers, and dummy Payment in a single transaction.
 */
async function confirmBooking({ userId, scheduleId, passengers }) {
  scheduleId = Number(scheduleId);

  if (!Array.isArray(passengers) || passengers.length === 0) {
    throw new ApiError(400, "Passengers array is required");
  }
  if (passengers.length > MAX_SEATS_PER_BOOKING) {
    throw new ApiError(
      400,
      `You can book at most ${MAX_SEATS_PER_BOOKING} seats per booking`
    );
  }

  // Validate passenger fields and collect seat labels
  const seatLabels = [];
  for (const [idx, p] of passengers.entries()) {
    if (!p || typeof p.name !== "string" || p.name.trim().length === 0) {
      throw new ApiError(400, `Passenger[${idx}].name is required`);
    }
    if (typeof p.age !== "number" || p.age <= 0) {
      throw new ApiError(400, `Passenger[${idx}].age must be a positive number`);
    }
    if (!p.gender || typeof p.gender !== "string") {
      throw new ApiError(400, `Passenger[${idx}].gender is required`);
    }
    if (!p.seatLabel || typeof p.seatLabel !== "string") {
      throw new ApiError(400, `Passenger[${idx}].seatLabel is required`);
    }
    seatLabels.push(p.seatLabel);
  }

  // Ensure no duplicate seat labels in a single booking
  const labelSet = new Set(seatLabels);
  if (labelSet.size !== seatLabels.length) {
    throw new ApiError(400, "Duplicate seat labels in passengers list");
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const schedule = await tx.busSchedule.findUnique({
      where: { id: scheduleId },
      include: { bus: true },
    });
    if (!schedule) {
      throw new ApiError(404, "Schedule not found");
    }

    // Resolve seats for this bus
    const seats = await tx.seat.findMany({
      where: {
        busId: schedule.busId,
        label: { in: seatLabels },
      },
    });
    if (seats.length !== seatLabels.length) {
      const foundLabels = new Set(seats.map((s) => s.label));
      const missing = seatLabels.filter((l) => !foundLabels.has(l));
      throw new ApiError(
        400,
        `Invalid seat labels for this bus: ${missing.join(", ")}`
      );
    }

    const seatIds = seats.map((s) => s.id);

    // Fetch seat availability rows for target seats
    const availabilities = await tx.seatAvailability.findMany({
      where: {
        scheduleId,
        seatId: { in: seatIds },
      },
    });

    if (availabilities.length !== seatIds.length) {
      throw new ApiError(
        500,
        "Seat availability not initialized correctly for this schedule"
      );
    }

    // Ensure they are BLOCKED by this user and not expired
    const seatIdByLabel = new Map(seats.map((s) => [s.label, s.id]));

    for (const sa of availabilities) {
      if (sa.status !== "BLOCKED") {
        throw new ApiError(
          409,
          "Some seats are not blocked and cannot be booked"
        );
      }
      if (sa.blockedById !== userId) {
        throw new ApiError(
          409,
          "Some seats are blocked by another user and cannot be booked"
        );
      }
      if (!sa.blockedUntil || sa.blockedUntil <= now) {
        throw new ApiError(
          409,
          "Some seats have expired blocks. Please block seats again."
        );
      }
    }

    // Compute total amount: schedule.price * number of passengers
    const totalAmount = schedule.price * passengers.length;

    // Create Booking
    const booking = await tx.booking.create({
      data: {
        userId,
        scheduleId,
        totalAmount,
        status: "CONFIRMED",
      },
    });

    // Create Passengers
    const passengerCreates = passengers.map((p) => ({
      bookingId: booking.id,
      name: p.name,
      age: p.age,
      gender: p.gender,
      seatLabel: p.seatLabel,
    }));

    await tx.passenger.createMany({
      data: passengerCreates,
    });

    // Dummy payment (always SUCCESS)
    const payment = await tx.payment.create({
      data: {
        bookingId: booking.id,
        amount: totalAmount,
        provider: "DUMMY",
        referenceId: `DUMMY-${booking.id}-${Date.now()}`,
        status: "SUCCESS",
      },
    });

    // Convert BLOCKED -> BOOKED for selected seats and set bookingId
    const targetSeatIdSet = new Set(seatIds);

    await tx.seatAvailability.updateMany({
      where: {
        scheduleId,
        seatId: { in: seatIds },
        status: "BLOCKED",
        blockedById: userId,
      },
      data: {
        status: "BOOKED",
        bookingId: booking.id,
        blockedById: null,
        blockedUntil: null,
      },
    });

    // Optional: release any other BLOCKED seats for this user on this schedule
    await tx.seatAvailability.updateMany({
      where: {
        scheduleId,
        status: "BLOCKED",
        blockedById: userId,
        seatId: { notIn: seatIds },
      },
      data: {
        status: "AVAILABLE",
        blockedById: null,
        blockedUntil: null,
      },
    });

    return {
      booking,
      payment,
      passengers: passengerCreates,
    };
  });

  return result;
}

async function getUserBookings(userId) {
  return await prisma.booking.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
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
  confirmBooking,
  getUserBookings,
};

