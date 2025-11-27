const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Iniciando migración de medicalOrders desde medicalRecord.medicalOrders -> MedicalOrder (tabla)');

  const records = await prisma.medicalRecord.findMany();
  let created = 0;
  let skipped = 0;

  for (const rec of records) {
    let orders = rec.medicalOrders;
    if (!orders) continue;

    if (typeof orders === 'string') {
      try {
        orders = JSON.parse(orders);
      } catch (e) {
        orders = [orders];
      }
    }

    if (!Array.isArray(orders)) orders = [orders];

    for (const o of orders) {
      if (!o || !o.id) {
        console.warn(`Orden inválida en record ${rec.id}:`, o);
        continue;
      }

      // Comprobar si ya existe en la tabla
      const exists = await prisma.medicalOrder.findUnique({ where: { id: String(o.id) } });
      if (exists) {
        skipped++;
        continue;
      }

      try {
        await prisma.medicalOrder.create({
          data: {
            id: String(o.id),
            type: o.type || 'unknown',
            patientId: Number(o.patientId || rec.userId),
            requestedBy: o.requestedBy || null,
            priority: o.priority || 'routine',
            clinicalNotes: o.clinicalNotes || null,
            tests: o.tests || (o.tests ? o.tests : []),
            status: o.status || 'CREATED',
            requestedAt: o.requestedAt ? new Date(o.requestedAt) : new Date(),
            medicalRecordId: rec.id
          }
        });
        created++;
      } catch (e) {
        console.error('Error creando MedicalOrder', o.id, e.message);
      }
    }
  }

  console.log(`Migración finalizada. Creadas: ${created}, Saltadas (existían): ${skipped}`);
}

run()
  .catch((e) => {
    console.error('Error durante migración:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
