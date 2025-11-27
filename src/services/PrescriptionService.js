const prisma = require('../config/database');

class PrescriptionService {
  async createPrescription({ doctorId, patientId, title, notes, medications }) {
    if (!doctorId || !patientId || !title || !medications) {
      const err = new Error('doctorId, patientId, title y medications son obligatorios');
      err.status = 400;
      throw err;
    }

    // Aceptar medications como array o JSON string
    let meds = medications;
    if (typeof meds === 'string') {
      try {
        meds = JSON.parse(medications);
      } catch (e) {
        const err = new Error('medications debe ser un JSON válido o un array');
        err.status = 400;
        throw err;
      }
    }

    if (!Array.isArray(meds) || meds.length === 0) {
      const err = new Error('medications debe ser un array no vacío');
      err.status = 400;
      throw err;
    }

    // Opcional: validar existencia de doctor y paciente
    const [doctor, patient] = await Promise.all([
      prisma.user.findUnique({ where: { id: Number(doctorId) } }),
      prisma.user.findUnique({ where: { id: Number(patientId) } })
    ]);

    if (!doctor) {
      const err = new Error('Médico no encontrado');
      err.status = 404;
      throw err;
    }

    if (!patient) {
      const err = new Error('Paciente no encontrado');
      err.status = 404;
      throw err;
    }

    // Crear prescripción
    const created = await prisma.prescription.create({
      data: {
        doctorId: Number(doctorId),
        patientId: Number(patientId),
        title,
        notes: notes || null,
        medications: meds
      }
    });

    return created;
  }

  async getByPatient(patientId, options = {}) {
    const { limit = 50, offset = 0 } = options;
    return prisma.prescription.findMany({
      where: { patientId: Number(patientId) },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
      include: { doctor: { select: { id: true, fullname: true } } }
    });
  }

  // Verificar alergias del paciente contra una lista de medicamentos
  // medications: array de objetos con al menos { name }
  async checkAllergies(patientId, medications) {
    if (!patientId) {
      const err = new Error('patientId es requerido');
      err.status = 400;
      throw err;
    }
    if (!medications || !Array.isArray(medications)) {
      const err = new Error('medications debe ser un array');
      err.status = 400;
      throw err;
    }

    // Obtener alergias del usuario (campo `allergies`) y de su medical record si existe
    const user = await prisma.user.findUnique({ where: { id: Number(patientId) }, select: { id: true, fullname: true, allergies: true } });
    if (!user) {
      const err = new Error('Paciente no encontrado');
      err.status = 404;
      throw err;
    }

    // Intentar leer alergias desde medical records (si contienen campo `allergies` JSON/string)
    const medRecord = await prisma.medicalRecord.findFirst({ where: { userId: Number(patientId) }, select: { allergies: true } });

    const allergySources = [];
    if (user.allergies) allergySources.push(user.allergies);
    if (medRecord && medRecord.allergies) allergySources.push(medRecord.allergies);

    // Normalizar lista de alergias: pueden venir como string separado por comas o como JSON
    let allergies = [];
    for (const src of allergySources) {
      if (!src) continue;
      if (typeof src === 'string') {
        try {
          const parsed = JSON.parse(src);
          if (Array.isArray(parsed)) {
            allergies = allergies.concat(parsed.map(s => String(s)));
            continue;
          }
        } catch (e) {
          // no JSON, tratar como CSV
        }
        // CSV split by commas or semicolons
        const parts = src.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
        allergies = allergies.concat(parts);
      } else if (Array.isArray(src)) {
        allergies = allergies.concat(src.map(s => String(s)));
      }
    }

    // Normalizar y deduplicar
    const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
    const allergySet = new Set(allergies.map(a => normalize(a)).filter(Boolean));

    // Para cada medicamento, comprobar si su nombre contiene alguna alergia
    const results = medications.map((med) => {
      const name = normalize(med.name || med);
      const matches = [];
      for (const a of allergySet) {
        if (!a) continue;
        // coincidencia simple: token aparece en el nombre
        if (name.includes(a)) matches.push(a);
      }
      return {
        medication: med,
        allergic: matches.length > 0,
        matches
      };
    });

    return { patient: { id: user.id, fullname: user.fullname }, results };
  }
}

module.exports = PrescriptionService;
