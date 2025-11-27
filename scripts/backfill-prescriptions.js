/* Backfill script: add durationDays to medications in existing prescriptions
 * WARNING: run on dev/staging first and backup DB before running in production.
 */

const prisma = require('../src/config/database');
const PrescriptionService = require('../src/services/PrescriptionService');

const service = new PrescriptionService();

async function run() {
  const batchSize = 200;
  let skip = 0;
  let updatedCount = 0;
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

        // Check if update is necessary
        const needsUpdate = JSON.stringify(meds) !== JSON.stringify(newMeds);
        if (needsUpdate) {
          await prisma.prescription.update({ where: { id: p.id }, data: { medications: newMeds } });
          updatedCount += 1;
          console.log(`Updated prescription id=${p.id}`);
        }
      }

      skip += items.length;
    }

    console.log(`Backfill finished. Prescriptions updated: ${updatedCount}`);
  } catch (err) {
    console.error('Error during backfill:', err);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  run().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { run };
