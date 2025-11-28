const prisma = require('../config/database');

async function listAll() {
  return await prisma.labExamType.findMany({ orderBy: { name: 'asc' } });
}

async function getByCode(code) {
  if (!code) return null;
  return await prisma.labExamType.findUnique({ where: { code } });
}

module.exports = { listAll, getByCode };
