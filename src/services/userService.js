const { prisma } = require("../prisma/client");

async function getCities() {
  return await prisma.city.findMany({
    orderBy: { name: "asc" },
  });
}

module.exports = {
  getCities,
};
