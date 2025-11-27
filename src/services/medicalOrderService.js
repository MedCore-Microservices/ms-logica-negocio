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

  const tests = (Array.isArray(requestedTests) ? requestedTests : []).map((t) => ({
    id: genId('t'),
    testCode: t.testCode || t.code || null,
    name: t.name || t.testName || null,
    specimen: t.specimen || null,
    notes: t.notes || null,
    status: 'PENDING',
    createdAt: now
  }));

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

  return newOrder;
}

module.exports = { createLaboratoryOrder };
