// Clean single migration script
const { PrismaClient: PrismaClient2 } = require('@prisma/client');
const prisma2 = new PrismaClient2();

async function migrate() {
  console.log('Starting migration: JSON orders -> MedicalOrder table');

  const records = await prisma2.medicalRecord.findMany({ where: {}, select: { id: true, medicalOrders: true } });

  for (const rec of records) {
    let orders = rec.medicalOrders;
    if (!orders) continue;
    if (typeof orders === 'string') {
      try { orders = JSON.parse(orders); } catch (e) { orders = [orders]; }
    }
    if (!Array.isArray(orders)) orders = [orders];

    let updated = false;

    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      if (!o || !o.id) continue;

      const idNum = Number(o.id);
      if (!Number.isNaN(idNum)) continue; // already numeric

      try {
        const created = await prisma2.medicalOrder.create({
          data: {
            type: o.type || 'laboratory',
            patientId: Number(o.patientId) || null,
            requestedBy: o.requestedBy || null,
            priority: o.priority || 'routine',
            clinicalNotes: o.clinicalNotes || null,
            tests: o.tests || [],
            status: o.status || 'CREATED',
            requestedAt: o.requestedAt ? new Date(o.requestedAt) : new Date(),
            medicalRecordId: rec.id
          }
        });

        orders[i].id = created.id;
        updated = true;
        console.log(`Migrated ${o.id} -> ${created.id} (record ${rec.id})`);
      } catch (e) {
        console.error('Failed to create MedicalOrder for', o.id, e.message);
      }
    }

    if (updated) {
      await prisma2.medicalRecord.update({ where: { id: rec.id }, data: { medicalOrders: orders } });
      console.log(`Updated medicalRecord ${rec.id}`);
    }
  }

  console.log('Done');
}

migrate()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma2.$disconnect());
