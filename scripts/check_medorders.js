const { PrismaClient } = require('@prisma/client');

async function main() {
  const idArg = process.argv[2];
  if (!idArg) {
    console.error('Usage: node scripts/check_medorders.js <orderId>');
    process.exit(2);
  }

  const idNum = Number(idArg);
  const prisma = new PrismaClient();

  try {
    console.log('Checking MedicalOrder table for id =', idArg);
    if (!Number.isNaN(idNum)) {
      const dbOrder = await prisma.medicalOrder.findUnique({ where: { id: idNum } });
      if (dbOrder) {
        console.log('\n-> Found in MedicalOrder table:');
        console.log(JSON.stringify(dbOrder, null, 2));
      } else {
        console.log('\n-> Not found in MedicalOrder table (by numeric id)');
      }
    } else {
      console.log('\n-> Skipping numeric lookup because id is not numeric');
    }

    console.log('\nSearching MedicalRecord.medicalOrders JSON for matching id...');
    const records = await prisma.medicalRecord.findMany({ select: { id: true, medicalOrders: true } });
    let foundInRecords = 0;
    for (const rec of records) {
      const orders = rec.medicalOrders;
      if (!orders) continue;
      let arr = orders;
      if (typeof arr === 'string') {
        try { arr = JSON.parse(arr); } catch (e) { arr = [arr]; }
      }
      if (!Array.isArray(arr)) arr = [arr];
      for (const o of arr) {
        if (!o || o.id === undefined) continue;
        // Compare as strings to be safe
        if (String(o.id) === String(idArg)) {
          console.log(`\n-> Found reference in MedicalRecord id=${rec.id}:`);
          console.log(JSON.stringify(o, null, 2));
          foundInRecords++;
        }
      }
    }
    if (foundInRecords === 0) console.log('\n-> No references found in any MedicalRecord.medicalOrders');

    // Also list a few recent medical orders in table for inspection
    console.log('\nListing up to 10 recent rows from MedicalOrder table:');
    try {
      const recent = await prisma.medicalOrder.findMany({ orderBy: { id: 'desc' }, take: 10 });
      console.log(JSON.stringify(recent, null, 2));
    } catch (e) {
      console.log('Could not query MedicalOrder table (maybe table not present or schema mismatch):', e.message);
    }

  } catch (e) {
    console.error('Error during check:', e.message);
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
