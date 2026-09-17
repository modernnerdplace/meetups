/**
 * Seed voor een verse database.
 *
 * Vult op dit moment alleen het archief: de elf gehouden meetups van
 * meetup.com. De seed is idempotent, dus `npm run seed` mag zo vaak als nodig.
 */

import { PrismaClient } from "@prisma/client";
import { importMeetupHistory } from "../scripts/import-meetup-history";

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    console.log("Seeding the meetup.com archive...");
    const result = await importMeetupHistory(prisma, {
      log: (message) => console.log(`  ${message}`),
    });
    console.log(
      `Archive ready: ${result.total} events, ${result.created} new, ${result.updated} updated.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
