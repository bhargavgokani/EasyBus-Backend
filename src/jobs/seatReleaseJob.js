const cron = require("node-cron");
const { prisma } = require("../prisma/client");

/**
 * Releases seats whose BLOCKED TTL has expired.
 *
 * Invariants we enforce here:
 * - BLOCKED seats must have blockedById + blockedUntil
 * If not, we treat them as invalid blocks and release them back to AVAILABLE.
 */
function initSeatReleaseCron() {
  // Every 1 minute (server time). All schedules are stored as timestamps; TTL comparisons use DB time values.
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      // 1) Release expired blocks
      const expired = await prisma.seatAvailability.updateMany({
        where: {
          status: "BLOCKED",
          blockedUntil: { lte: now },
        },
        data: {
          status: "AVAILABLE",
          blockedById: null,
          blockedUntil: null,
        },
      });

      // 2) Release invalid blocks (missing blockedById or blockedUntil)
      const invalid = await prisma.seatAvailability.updateMany({
        where: {
          status: "BLOCKED",
          OR: [{ blockedById: null }, { blockedUntil: null }],
        },
        data: {
          status: "AVAILABLE",
          blockedById: null,
          blockedUntil: null,
        },
      });

      const totalReleased = (expired.count || 0) + (invalid.count || 0);
      if (totalReleased > 0) {
        console.log(
          `[seatReleaseJob] Released ${totalReleased} seats (expired=${expired.count}, invalid=${invalid.count})`
        );
      }
    } catch (err) {
      console.error("[seatReleaseJob] Failed to release expired seats", err);
    }
  });
}

module.exports = { initSeatReleaseCron };

