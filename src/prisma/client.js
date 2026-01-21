const { PrismaClient } = require("@prisma/client");

// Prisma v7: datasource URL is provided at runtime (schema no longer stores it).
const prisma = new PrismaClient();

module.exports = { prisma };

