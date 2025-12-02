const prisma = require('../config/database');

function genId(prefix = 'ord') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createLaboratoryOrder(payload = {}, ctx = {}) {
  const { patientId, requestedBy, priority, clinicalNotes, requestedTests, requestedAt } = payload;

  if (!patientId) {
    const err = new Error('patientId es requerido');
    err.status = 400;
    throw err;
  }

  // Verificar que exista el paciente
  const patient = await prisma.user.findUnique({ where: { id: Number(patientId) } });
  if (!patient) {
    const err = new Error('Paciente no encontrado');
    err.status = 404;
    throw err;
  }

  // Buscar la historia clínica más reciente del paciente
  let medRecord = await prisma.medicalRecord.findFirst({
    where: { userId: Number(patientId) },
    orderBy: { createdAt: 'desc' }
  });

  // Si no existe, crear una historia clínica mínima (schema requiere diagnosis, description y treatment)
  if (!medRecord) {
    medRecord = await prisma.medicalRecord.create({
      data: {
        userId: Number(patientId),
        diagnosis: 'Ordenes de laboratorio (auto-generado)',
        description: 'Historia clínica creada automáticamente para almacenar órdenes de laboratorio',
        treatment: 'N/A'
      }
    });
  }

  // Preparar la orden
  const orderId = genId('labord');
  const now = new Date();

  // Enriquecer los tests con información de la base de datos
  const enrichedTests = [];
  for (const t of (Array.isArray(requestedTests) ? requestedTests : [])) {
    const testCode = t.testCode || t.code || t;
    let testInfo = { testCode };
    
    // Buscar información del examen en la tabla LabExamType
    try {
      const examType = await prisma.labExamType.findFirst({
        where: { code: String(testCode) }
      });
      if (examType) {
        testInfo = {
          id: genId('t'),
          testCode: examType.code,
          name: examType.name,
          description: examType.description,
          specimen: t.specimen || null,
          notes: t.notes || null,
          status: 'PENDING',
          createdAt: now
        };
      } else {
        // Si no se encuentra, usar la info proporcionada
        testInfo = {
          id: genId('t'),
          testCode,
          name: t.name || t.testName || `Examen ${testCode}`,
          description: t.description || null,
          specimen: t.specimen || null,
          notes: t.notes || null,
          status: 'PENDING',
          createdAt: now
        };
      }
    } catch (e) {
      // Fallback si hay error
      testInfo = {
        id: genId('t'),
        testCode,
        name: t.name || t.testName || `Examen ${testCode}`,
        description: t.description || null,
        specimen: t.specimen || null,
        notes: t.notes || null,
        status: 'PENDING',
        createdAt: now
      };
    }
    enrichedTests.push(testInfo);
  }

  const tests = enrichedTests;

  const newOrder = {
    id: orderId,
    type: 'laboratory',
    patientId: Number(patientId),
    requestedBy: requestedBy || ctx.userId || null,
    priority: priority || 'routine',
    clinicalNotes: clinicalNotes || null,
    requestedAt: requestedAt || now,
    status: 'CREATED',
    tests,
    createdAt: now
  };

  // Obtener órdenes existentes (asegurarse que sea array)
  let existing = medRecord.medicalOrders;
  if (!existing) existing = [];
  if (!Array.isArray(existing)) {
    // si por alguna razón está almacenado como objeto, convertir a array
    existing = [existing];
  }

  const updatedOrders = [...existing, newOrder];

  // Actualizar la historia clínica con la nueva orden en el campo JSON
  const updatedRecord = await prisma.medicalRecord.update({
    where: { id: medRecord.id },
    data: { medicalOrders: updatedOrders }
  });

  // Intentar persistir también en la tabla `MedicalOrder` (si existe)
  await persistOrderToTable(newOrder, medRecord.id);

  return newOrder;
}

async function createRadiologyOrder(payload = {}, ctx = {}) {
  const { patientId, requestedBy, priority, clinicalNotes, requestedTests, requestedAt } = payload;

  if (!patientId) {
    const err = new Error('patientId es requerido');
    err.status = 400;
    throw err;
  }

  // Verificar que exista el paciente
  const patient = await prisma.user.findUnique({ where: { id: Number(patientId) } });
  if (!patient) {
    const err = new Error('Paciente no encontrado');
    err.status = 404;
    throw err;
  }

  // Buscar la historia clínica más reciente del paciente
  let medRecord = await prisma.medicalRecord.findFirst({
    where: { userId: Number(patientId) },
    orderBy: { createdAt: 'desc' }
  });

  // Si no existe, crear una historia clínica mínima
  if (!medRecord) {
    medRecord = await prisma.medicalRecord.create({
      data: {
        userId: Number(patientId),
        diagnosis: 'Ordenes de radiología (auto-generado)',
        description: 'Historia clínica creada automáticamente para almacenar órdenes de radiología',
        treatment: 'N/A'
      }
    });
  }

  const orderId = genId('radord');
  const now = new Date();

  // Enriquecer los tests de radiología con información de la base de datos
  const enrichedTests = [];
  for (const t of (Array.isArray(requestedTests) ? requestedTests : [])) {
    const testCode = t.testCode || t.code || t;
    let testInfo = { testCode };
    
    // Buscar información del examen en la tabla RadiologyExamType
    try {
      const examType = await prisma.radiologyExamType.findFirst({
        where: { code: String(testCode) }
      });
      if (examType) {
        testInfo = {
          id: genId('t'),
          testCode: examType.code,
          name: examType.name,
          description: examType.description,
          modality: t.modality || t.type || null,
          bodyPart: t.bodyPart || t.region || null,
          laterality: t.laterality || null,
          notes: t.notes || null,
          status: 'SCHEDULED',
          createdAt: now
        };
      } else {
        // Si no se encuentra, usar la info proporcionada
        testInfo = {
          id: genId('t'),
          testCode,
          name: t.name || t.testName || `Examen ${testCode}`,
          description: t.description || null,
          modality: t.modality || t.type || null,
          bodyPart: t.bodyPart || t.region || null,
          laterality: t.laterality || null,
          notes: t.notes || null,
          status: 'SCHEDULED',
          createdAt: now
        };
      }
    } catch (e) {
      // Fallback si hay error
      testInfo = {
        id: genId('t'),
        testCode,
        name: t.name || t.testName || `Examen ${testCode}`,
        description: t.description || null,
        modality: t.modality || t.type || null,
        bodyPart: t.bodyPart || t.region || null,
        laterality: t.laterality || null,
        notes: t.notes || null,
        status: 'SCHEDULED',
        createdAt: now
      };
    }
    enrichedTests.push(testInfo);
  }

  const tests = enrichedTests;

  const newOrder = {
    id: orderId,
    type: 'radiology',
    patientId: Number(patientId),
    requestedBy: requestedBy || ctx.userId || null,
    priority: priority || 'routine',
    clinicalNotes: clinicalNotes || null,
    requestedAt: requestedAt || now,
    status: 'CREATED',
    tests,
    createdAt: now
  };

  let existing = medRecord.medicalOrders;
  if (!existing) existing = [];
  if (!Array.isArray(existing)) existing = [existing];

  const updatedOrders = [...existing, newOrder];

  const updatedRecord = await prisma.medicalRecord.update({
    where: { id: medRecord.id },
    data: { medicalOrders: updatedOrders }
  });

  // Intentar persistir también en la tabla `MedicalOrder` (si existe)
  await persistOrderToTable(newOrder, medRecord.id);

  return newOrder;
}
 
async function getOrderById(orderId) {
  if (!orderId) {
    const err = new Error('orderId es requerido');
    err.status = 400;
    throw err;
  }
  // Intentar primero buscar en la nueva tabla `MedicalOrder` si existe
  try {
    const dbOrder = await prisma.medicalOrder.findUnique({ where: { id: String(orderId) } });
    if (dbOrder) {
      return { order: dbOrder, medicalRecordId: dbOrder.medicalRecordId, patientId: dbOrder.patientId };
    }
  } catch (e) {
    // Si la tabla no existe aún (antes de migrar), continuamos con búsqueda en JSON
    // console.warn('[getOrderById] medicalOrder table not present or query failed', e.message);
  }

  // Fallback: buscar en las historias clínicas cargando todas y buscando en el JSON
  const records = await prisma.medicalRecord.findMany();

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

    const found = orders.find((o) => String(o.id) === String(orderId));
    if (found) {
      return { order: found, medicalRecordId: rec.id, patientId: rec.userId };
    }
  }

  const err = new Error('Orden médica no encontrada');
  err.status = 404;
  throw err;
}

// Helper: crear fila en la tabla MedicalOrder para nuevas órdenes (si la tabla existe)
async function persistOrderToTable(newOrder, medRecordId) {
  try {
    // Crear registro en la tabla `MedicalOrder` (si existe)
    await prisma.medicalOrder.create({
      data: {
        id: String(newOrder.id),
        type: newOrder.type,
        patientId: Number(newOrder.patientId),
        requestedBy: newOrder.requestedBy || null,
        priority: newOrder.priority || 'routine',
        clinicalNotes: newOrder.clinicalNotes || null,
        tests: newOrder.tests || [],
        status: newOrder.status || 'CREATED',
        requestedAt: newOrder.requestedAt || new Date(),
        medicalRecordId: medRecordId || null
      }
    });
  } catch (e) {
    // Si la tabla no existe aún o hay error, ignoramos para mantener compatibilidad
    console.warn('[persistOrderToTable] could not persist order:', e.message);
  }
}

// Helper: enriquecer tests con información de la BD (para órdenes antiguas)
async function enrichOrderTests(order) {
  if (!order || !Array.isArray(order.tests) || order.tests.length === 0) {
    return order;
  }

  const enrichedTests = [];
  const isLaboratory = order.type === 'laboratory';
  
  for (const test of order.tests) {
    // Si ya tiene nombre, no hacer nada
    if (test.name && test.name !== 'Examen sin nombre') {
      enrichedTests.push(test);
      continue;
    }

    const testCode = test.testCode || test.code;
    if (!testCode) {
      enrichedTests.push({ ...test, name: 'Examen sin código' });
      continue;
    }

    try {
      if (isLaboratory) {
        const examType = await prisma.labExamType.findFirst({
          where: { code: String(testCode) }
        });
        if (examType) {
          enrichedTests.push({
            ...test,
            name: examType.name,
            description: examType.description || test.description
          });
          continue;
        }
      } else {
        const examType = await prisma.radiologyExamType.findFirst({
          where: { code: String(testCode) }
        });
        if (examType) {
          enrichedTests.push({
            ...test,
            name: examType.name,
            description: examType.description || test.description
          });
          continue;
        }
      }
    } catch (e) {
      console.warn('[enrichOrderTests] Error enriching test:', e.message);
    }

    // Si no se encontró, usar el código como nombre
    enrichedTests.push({ ...test, name: `Examen ${testCode}` });
  }

  return { ...order, tests: enrichedTests };
}

async function getOrdersByPatient(patientId, opts = {}) {
  if (!patientId) {
    const err = new Error('patientId es requerido');
    err.status = 400;
    throw err;
  }

  const limit = opts.limit ? Number(opts.limit) : 50;
  const offset = opts.offset ? Number(opts.offset) : 0;

  // Intentar obtener desde la tabla MedicalOrder si existe
  try {
    const dbOrders = await prisma.medicalOrder.findMany({
      where: { patientId: Number(patientId) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        patient: {
          select: {
            id: true,
            fullname: true,
            identificationNumber: true,
            email: true
          }
        },
        requestedByUser: {
          select: {
            id: true,
            fullname: true,
            role: true
          }
        }
      }
    });

    if (dbOrders && dbOrders.length > 0) {
      // Enriquecer tests con información de la BD
      const enrichedOrders = await Promise.all(
        dbOrders.map(order => enrichOrderTests(order))
      );
      return enrichedOrders;
    }
  } catch (e) {
    // Si falla (tabla no existe), caeremos al fallback
  }

  // Fallback: buscar en medicalRecord.medicalOrders (JSON)
  const records = await prisma.medicalRecord.findMany({ 
    where: { userId: Number(patientId) }, 
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          fullname: true,
          identificationNumber: true,
          email: true
        }
      }
    }
  });
  const allOrders = [];

  // Obtener IDs únicos de doctores para consultar después
  const doctorIds = new Set();
  for (const rec of records) {
    let orders = rec.medicalOrders;
    if (!orders) continue;
    if (typeof orders === 'string') {
      try { orders = JSON.parse(orders); } catch (e) { orders = [orders]; }
    }
    if (!Array.isArray(orders)) orders = [orders];
    for (const o of orders) {
      if (o.requestedBy) doctorIds.add(Number(o.requestedBy));
    }
  }

  // Consultar información de doctores
  const doctors = await prisma.user.findMany({
    where: { id: { in: Array.from(doctorIds) } },
    select: {
      id: true,
      fullname: true,
      role: true
    }
  });
  const doctorMap = new Map(doctors.map(d => [d.id, d]));

  for (const rec of records) {
    let orders = rec.medicalOrders;
    if (!orders) continue;

    if (typeof orders === 'string') {
      try { orders = JSON.parse(orders); } catch (e) { orders = [orders]; }
    }
    if (!Array.isArray(orders)) orders = [orders];

    for (const o of orders) {
      allOrders.push({ 
        ...o, 
        medicalRecordId: rec.id, 
        patientId: rec.userId,
        patient: rec.user,
        requestedByUser: o.requestedBy ? doctorMap.get(Number(o.requestedBy)) : null
      });
    }
  }

  // ordenar por createdAt si existe
  allOrders.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });

  // aplicar paginación
}


// GET ALL ORDERS (para doctores/administradores)
async function getAllOrders(opts = {}) {
  const limit = opts.limit ? Number(opts.limit) : 50;
  const offset = opts.offset ? Number(opts.offset) : 0;
  const type = opts.type; // 'laboratory' o 'radiology', opcional

  // Intentar obtener desde la tabla MedicalOrder si existe
  try {
    const where = type ? { type } : {};
    const dbOrders = await prisma.medicalOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        patient: {
          select: {
            id: true,
            fullname: true,
            identificationNumber: true,
            email: true
          }
        },
        requestedByUser: {
          select: {
            id: true,
            fullname: true,
            role: true
          }
        }
      }
    });

    if (dbOrders && dbOrders.length > 0) {
      // Enriquecer tests con información de la BD
      const enrichedOrders = await Promise.all(
        dbOrders.map(order => enrichOrderTests(order))
      );
      return enrichedOrders;
    }
  } catch (e) {
    console.warn('[getAllOrders] Could not fetch from MedicalOrder table:', e.message);
  }

  // Fallback: buscar en medicalRecord.medicalOrders (JSON) - todas las órdenes
  const records = await prisma.medicalRecord.findMany({ 
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          fullname: true,
          identificationNumber: true,
          email: true
        }
      }
    }
  });
  
  const allOrders = [];

  // Obtener IDs únicos de doctores para consultar después
  const doctorIds = new Set();
  for (const rec of records) {
    let orders = rec.medicalOrders;
    if (!orders) continue;
    if (typeof orders === 'string') {
      try { orders = JSON.parse(orders); } catch (e) { orders = [orders]; }
    }
    if (!Array.isArray(orders)) orders = [orders];
    for (const o of orders) {
      if (o.requestedBy) doctorIds.add(Number(o.requestedBy));
    }
  }

  // Consultar información de doctores
  const doctors = await prisma.user.findMany({
    where: { id: { in: Array.from(doctorIds) } },
    select: {
      id: true,
      fullname: true,
      role: true
    }
  });
  const doctorMap = new Map(doctors.map(d => [d.id, d]));

  for (const rec of records) {
    let orders = rec.medicalOrders;
    if (!orders) continue;

    if (typeof orders === 'string') {
      try { orders = JSON.parse(orders); } catch (e) { orders = [orders]; }
    }
    if (!Array.isArray(orders)) orders = [orders];

    for (const o of orders) {
      if (type && o.type !== type) continue; // Filtrar por tipo si se especifica
      allOrders.push({ 
        ...o, 
        medicalRecordId: rec.id, 
        patientId: rec.userId,
        patient: rec.user,
        requestedByUser: o.requestedBy ? doctorMap.get(Number(o.requestedBy)) : null
      });
    }
  }

  // ordenar por createdAt si existe
  allOrders.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });

  // aplicar paginación
  const paged = allOrders.slice(offset, offset + limit);
  
  // Enriquecer tests con información de la BD
  const enrichedPaged = await Promise.all(
    paged.map(order => enrichOrderTests(order))
  );
  
  return enrichedPaged;
}

module.exports = { 
  createLaboratoryOrder, 
  createRadiologyOrder, 
  getOrderById, 
  getOrdersByPatient,
  getAllOrders 
};