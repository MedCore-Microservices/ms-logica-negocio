const prisma = require('../config/database');

// POST /api/medical-records - Crear historia clínica
const createMedicalRecord = async (req, res) => {
  try {
    const { patientId, diagnosis, description, treatment, departmentId, doctorId } = req.body;

    // Validaciones básicas
    if (!patientId || isNaN(patientId)) {
      return res.status(400).json({ message: 'patientId es requerido y debe ser un número válido.' });
    }

    if (!diagnosis || !description || !treatment) {
      return res.status(400).json({ 
        message: 'diagnosis, description y treatment son campos requeridos.' 
      });
    }

    const newRecord = await prisma.medicalRecord.create({
      data: {
        userId: parseInt(patientId),
        diagnosis,
        description,
        treatment, // CAMPO OBLIGATORIO AÑADIDO
        departmentId: departmentId ? parseInt(departmentId) : null,
        doctorId: doctorId ? parseInt(doctorId) : null
      },
      include: {
        department: { select: { name: true } },
        doctor: { select: { fullname: true } },
        user: { select: { fullname: true } }
      }
    });

    return res.status(201).json(newRecord);
  } catch (error) {
    console.error('Error al crear historia clínica:', error);
    
    if (error.code === 'P2003') {
      return res.status(400).json({ message: 'El paciente, doctor o departamento no existe.' });
    }
    
    return res.status(500).json({ 
      message: 'Error al crear la historia clínica.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET /api/medical-records/patient/:patientId - Obtener historial
const getMedicalRecordsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Validate patientId
    if (isNaN(patientId)) {
      return res.status(400).json({ message: 'Invalid patientId. It must be a number.' });
    }

    const records = await prisma.medicalRecord.findMany({
      where: { userId: parseInt(patientId) },
      orderBy: { createdAt: 'desc' },
      include: {
        department: { select: { name: true } },
        doctor: { select: { fullname: true } }
      }
    });

    return res.status(200).json(records);
  } catch (error) {
    console.error('Error al obtener historial del paciente:', error);

    // Enhanced error response
    return res.status(500).json({
      message: 'Error al obtener el historial del paciente.',
      error: error.message
    });
  }
};

// PUT /api/medical-records/:id - Actualizar registro
const updateMedicalRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { diagnosis, description, departmentId, doctorId } = req.body;

    // Validar que el registro médico exista
    const existingRecord = await prisma.medicalRecord.findUnique({
      where: { id: parseInt(id) },
      include: { user: true }
    });

    if (!existingRecord) {
      return res.status(404).json({ message: 'Registro médico no encontrado.' });
    }

    // Si se proporciona doctorId, validar que sea un médico
    if (doctorId) {
      const doctor = await prisma.user.findUnique({
        where: { 
          id: parseInt(doctorId),
          role: 'MEDICO' // Asegurar que sea un médico
        }
      });

      if (!doctor) {
        return res.status(400).json({ message: 'El doctor especificado no existe o no es un médico válido.' });
      }
    }

    // Si se proporciona departmentId, validar que el departamento exista
    if (departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: parseInt(departmentId) }
      });

      if (!department) {
        return res.status(400).json({ message: 'El departamento especificado no existe.' });
      }
    }

    // Actualizar el registro médico
    const updatedRecord = await prisma.medicalRecord.update({
      where: { id: parseInt(id) },
      data: {
        diagnosis,
        description,
        departmentId: departmentId ? parseInt(departmentId) : null,
        doctorId: doctorId ? parseInt(doctorId) : null
      },
      include: {
        department: { select: { name: true } },
        doctor: { select: { fullname: true } },
        user: { select: { fullname: true } }
      }
    });

    return res.status(200).json(updatedRecord);
  } catch (error) {
    console.error('Error al actualizar historia clínica:', error);
    
    // Manejar errores específicos de Prisma
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Registro médico no encontrado.' });
    }
    
    return res.status(500).json({ 
      message: 'Error al actualizar la historia clínica.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET /api/medical-records/:id/timeline - Timeline del paciente
const getMedicalRecordTimeline = async (req, res) => {
  try {
    const { id } = req.params;

    const medicalRecord = await prisma.medicalRecord.findUnique({
      where: { id: parseInt(id) },
      include: {
        department: { select: { name: true } },
        doctor: { select: { fullname: true } },
        user: { select: { fullname: true } }, // Información del paciente
        appointments: { // Incluir citas relacionadas
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            date: true,
            reason: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    if (!medicalRecord) {
      return res.status(404).json({ message: 'Historia clínica no encontrada.' });
    }

    // Crear un timeline manual con la información disponible
    const timeline = {
      medicalRecord: {
        id: medicalRecord.id,
        diagnosis: medicalRecord.diagnosis,
        description: medicalRecord.description,
        treatment: medicalRecord.treatment,
        createdAt: medicalRecord.createdAt,
        updatedAt: medicalRecord.updatedAt,
        department: medicalRecord.department,
        doctor: medicalRecord.doctor,
        patient: medicalRecord.user
      },
      events: [
        {
          type: 'CREATION',
          description: 'Historia clínica creada',
          date: medicalRecord.createdAt
        },
        // Puedes agregar más eventos manualmente aquí
      ],
      appointments: medicalRecord.appointments
    };

    return res.status(200).json(timeline);
  } catch (error) {
    console.error('Error al obtener timeline de la historia clínica:', error);
    return res.status(500).json({ 
      message: 'Error al obtener el timeline de la historia clínica.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createMedicalRecord,
  getMedicalRecordsByPatient,
  updateMedicalRecord,
  getMedicalRecordTimeline
};