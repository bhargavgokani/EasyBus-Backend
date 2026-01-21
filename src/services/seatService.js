const { prisma } = require("../prisma/client");
const { ApiError } = require("../utils/ApiError");

const BLOCK_TTL_MINUTES = 10;
const MAX_SEATS_PER_BLOCK = 6;

async function getSeatsForSchedule(scheduleId) {
  const schedule = await prisma.busSchedule.findUnique({
    where: { id: Number(scheduleId) },
    include: {
      bus: {
        include: {
          seats: {
            orderBy: { label: "asc" },
          },
        },
      },
      seatAvailabilities: {
        include: {
          seat: true,
        },
      },
    },
  });

  if (!schedule) {
    throw new ApiError(404, "Schedule not found");
  }

  // Map seatId -> availability
  const now = new Date();
  const availabilityBySeatId = new Map();
  for (const sa of schedule.seatAvailabilities) {
    // Treat expired blocked seats as AVAILABLE in API response
    if (sa.status === "BLOCKED" && sa.blockedUntil && sa.blockedUntil <= now) {
      availabilityBySeatId.set(sa.seatId, {
        status: "AVAILABLE",
      });
    } else {
      availabilityBySeatId.set(sa.seatId, {
        status: sa.status,
        blockedUntil: sa.blockedUntil,
        blockedById: sa.blockedById,
        bookingId: sa.bookingId,
      });
    }
  }

  const seats = schedule.bus.seats.map((seat) => {
    const av = availabilityBySeatId.get(seat.id) || { status: "AVAILABLE" };
    return {
      id: seat.id,
      label: seat.label,
      status: av.status,
      blockedUntil: av.blockedUntil,
      blockedById: av.blockedById,
      bookingId: av.bookingId,
    };
  });

  const availableCount = seats.filter((s) => s.status === "AVAILABLE").length;

  return {
    scheduleId: schedule.id,
    busId: schedule.busId,
    routeId: schedule.routeId,
    travelDate: schedule.travelDate,
    departureTime: schedule.departureTime,
    arrivalTime: schedule.arrivalTime,
    price: schedule.price,
    seats,
    availableCount,
  };
}

/**
 * Seat blocking rules:
 * - A user can block up to MAX_SEATS_PER_BLOCK seats in a single request.
 * - Only ONE active block "session" per user across all schedules:
 *   if user has any non-expired BLOCKED seats on another schedule, this call fails.
 * - If the same user blocks again on the same schedule, TTL is extended to now + 10 minutes
 *   for all seats included in this request (append + refresh).
 * - BLOCKED seats must have blockedById + blockedUntil set.
 */
async function blockSeatsForUser({ userId, scheduleId, seatLabels }) {
  scheduleId = Number(scheduleId);
  if (!Array.isArray(seatLabels) || seatLabels.length === 0) {
    throw new ApiError(400, "seatLabels must be a non-empty array");
  }
  if (seatLabels.length > MAX_SEATS_PER_BLOCK) {
    throw new ApiError(
      400,
      `You can block at most ${MAX_SEATS_PER_BLOCK} seats per request`
    );
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + BLOCK_TTL_MINUTES * 60 * 1000);

  const result = await prisma.$transaction(async (tx) => {
    const schedule = await tx.busSchedule.findUnique({
      where: { id: scheduleId },
      include: { bus: true },
    });
    if (!schedule) {
      throw new ApiError(404, "Schedule not found");
    }

    // Release expired BLOCKED seats for this schedule inline (defensive; cron will also clean).
    await tx.seatAvailability.updateMany({
      where: {
        scheduleId,
        status: "BLOCKED",
        blockedUntil: { lte: now },
      },
      data: {
        status: "AVAILABLE",
        blockedById: null,
        blockedUntil: null,
      },
    });

    // Enforce single active block session per user across schedules
    const otherActiveBlock = await tx.seatAvailability.findFirst({
      where: {
        blockedById: userId,
        status: "BLOCKED",
        blockedUntil: { gt: now },
        scheduleId: { not: scheduleId },
      },
      select: { scheduleId: true },
    });

    if (otherActiveBlock) {
      throw new ApiError(
        409,
        "You already have an active seat block on another schedule. Complete or wait for it to expire."
      );
    }

    // Resolve bus seats by labels
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

    // Fetch corresponding seat availability rows with current status
    const availabilities = await tx.seatAvailability.findMany({
      where: {
        scheduleId,
        seatId: { in: seatIds },
      },
    });

    // If some seatAvailability rows are missing (e.g., schedule setup bug), error clearly
    if (availabilities.length !== seatIds.length) {
      throw new ApiError(
        500,
        "Seat availability not initialized correctly for this schedule"
      );
    }

    // Validate each seat's current state
    const conflicts = [];
    for (const sa of availabilities) {
      // Treat expired BLOCKED as AVAILABLE (should have been released above, but double-check)
      const isExpiredBlock =
        sa.status === "BLOCKED" && sa.blockedUntil && sa.blockedUntil <= now;

      if (sa.status === "BOOKED") {
        conflicts.push({
          seatId: sa.seatId,
          reason: "BOOKED",
        });
      } else if (
        sa.status === "BLOCKED" &&
        !isExpiredBlock &&
        sa.blockedById !== userId
      ) {
        conflicts.push({
          seatId: sa.seatId,
          reason: "BLOCKED_BY_OTHER",
        });
      }
    }

    if (conflicts.length > 0) {
      const bySeatId = new Map(seats.map((s) => [s.id, s.label]));
      const conflictLabels = conflicts.map((c) => bySeatId.get(c.seatId));
      throw new ApiError(
        409,
        `Some seats are not available: ${conflictLabels.join(", ")}`
      );
    }

    // All target seats are either AVAILABLE or BLOCKED by same user / expired.
    // Block or refresh them and set blockedById + blockedUntil.
    const updated = [];
    for (const seat of seats) {
      const sa = await tx.seatAvailability.update({
        where: {
          scheduleId_seatId: {
            scheduleId,
            seatId: seat.id,
          },
        },
        data: {
          status: "BLOCKED",
          blockedById: userId,
          blockedUntil: expiresAt,
        },
      });
      updated.push(sa);
    }

    return {
      scheduleId,
      expiresAt,
      seats: seats.map((s) => ({
        id: s.id,
        label: s.label,
      })),
    };
  });

  return result;
}

module.exports = {
  getSeatsForSchedule,
  blockSeatsForUser,
};

