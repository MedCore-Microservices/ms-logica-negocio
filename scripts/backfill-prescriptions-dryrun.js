/* Dry-run backfill: report how many prescriptions would be updated without writing changes */
const prisma = require('../src/config/database');
const PrescriptionService = require('../src/services/PrescriptionService');
const service = new PrescriptionService();

async function run() {
  const batchSize = 200;
  let skip = 0;
  let wouldUpdate = 0;
  try {
    while (true) {
      const items = await prisma.prescription.findMany({
        take: batchSize,
        skip,
        select: { id: true, medications: true }
      });

      if (!items || items.length === 0) break;

      for (const p of items) {
        const meds = Array.isArray(p.medications) ? p.medications : [];
        const newMeds = meds.map((m) => {
          const medObj = (typeof m === 'string') ? { name: m } : Object.assign({}, m);
          if (!medObj.durationDays) medObj.durationDays = service.inferDuration(medObj);
          return medObj;
        });

        const needsUpdate = JSON.stringify(meds) !== JSON.stringify(newMeds);
        if (needsUpdate) wouldUpdate += 1;
      }

      skip += items.length;
    }

    console.log(`Dry-run finished. Prescriptions that would be updated: ${wouldUpdate}`);
  } catch (err) {
    console.error('Error during dry-run:', err);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) run();
module.exports = { run };
