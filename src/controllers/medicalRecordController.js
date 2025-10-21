const prisma = require('../config/database');

// POST /api/medical-records - Crear historia clínica
const createMedicalRecord = async (req, res) => {
  try {
    const { patientId, diagnosis, description, departmentId, doctorId } = req.body;

    const newRecord = await prisma.medicalRecord.create({
      data: {
        patientId,
        diagnosis,
        description,
        departmentId,
        doctorId
      }
    });

    return res.status(201).json(newRecord);
  } catch (error) {
    console.error('Error al crear historia clínica:', error);
    return res.status(500).json({ message: 'Error al crear la historia clínica.' });
  }
};

// GET /api/medical-records/patient/:patientId - Obtener historial
const getMedicalRecordsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;

    const records = await prisma.medicalRecord.findMany({
      where: { patientId: parseInt(patientId) },
      orderBy: { createdAt: 'desc' },
      include: {
        department: { select: { name: true } },
        doctor: { select: { fullname: true } }
      }
    });

    return res.status(200).json(records);
  } catch (error) {
    console.error('Error al obtener historial del paciente:', error);
    return res.status(500).json({ message: 'Error al obtener el historial del paciente.' });
  }
};

// PUT /api/medical-records/:id - Actualizar registro
const updateMedicalRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { diagnosis, description, departmentId, doctorId } = req.body;

    const updatedRecord = await prisma.medicalRecord.update({
      where: { id: parseInt(id) },
      data: {
        diagnosis,
        description,
        departmentId,
        doctorId
      }
    });

    return res.status(200).json(updatedRecord);
  } catch (error) {
    console.error('Error al actualizar historia clínica:', error);
    return res.status(500).json({ message: 'Error al actualizar la historia clínica.' });
  }
};

// GET /api/medical-records/:id/timeline - Timeline del paciente
const getMedicalRecordTimeline = async (req, res) => {
  try {
    const { id } = req.params;

    const timeline = await prisma.medicalRecord.findUnique({
      where: { id: parseInt(id) },
      include: {
        department: { select: { name: true } },
        doctor: { select: { fullname: true } },
        updates: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            description: true,
            createdAt: true
          }
        }
      }
    });

    if (!timeline) {
      return res.status(404).json({ message: 'Historia clínica no encontrada.' });
    }

    return res.status(200).json(timeline);
  } catch (error) {
    console.error('Error al obtener timeline de la historia clínica:', error);
    return res.status(500).json({ message: 'Error al obtener el timeline de la historia clínica.' });
  }
};

module.exports = {
  createMedicalRecord,
  getMedicalRecordsByPatient,
  updateMedicalRecord,
  getMedicalRecordTimeline
};