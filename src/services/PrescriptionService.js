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
}

module.exports = PrescriptionService;
