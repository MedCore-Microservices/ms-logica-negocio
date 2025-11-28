const prisma = require('../config/database');

// Intentamos leer desde la tabla específica de radiología; si no existe o está vacía,
// usamos `labExamType` como fallback (mapeando `tests` -> `procedures`).
const RAD_CODES_FALLBACK = ['RAYOS_X', 'TAC', 'RESONANCIA', 'ECOGRAFIA'];

async function listAll() {
  try {
    const rows = await prisma.radiologyExamType.findMany({ orderBy: { name: 'asc' } });
    if (rows && rows.length > 0) return rows;
  } catch (e) {
    // ignorar y caer al fallback
  }

  // Fallback: buscar en labExamType por los códigos radiológicos
  try {
    const fallback = await prisma.labExamType.findMany({ where: { code: { in: RAD_CODES_FALLBACK } }, orderBy: { name: 'asc' } });
    // mapear `tests` -> `procedures`
    return fallback.map((f) => ({ ...f, procedures: f.tests }));
  } catch (e) {
    return [];
  }
}

async function getByCode(code) {
  if (!code) return null;
  const normalized = String(code).toUpperCase().replace(/\s+/g, '_');

  // Intentar en tabla específica
  try {
    const row = await prisma.radiologyExamType.findUnique({ where: { code: normalized } });
    if (row) return row;
  } catch (e) {
    // ignorar y seguir al fallback
  }

  // Fallback: buscar en labExamType
  try {
    const f = await prisma.labExamType.findUnique({ where: { code: normalized } });
    if (!f) return null;
    return { ...f, procedures: f.tests };
  } catch (e) {
    return null;
  }
}

module.exports = { listAll, getByCode };
