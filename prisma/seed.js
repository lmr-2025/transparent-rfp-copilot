/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.info("[seed] No default data to insert. Customize prisma/seed.js to add initial records.");
}

main()
  .catch((error) => {
    console.error("[seed] Failed to run seed script", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
