const prisma = require('../config/database');

// GET /api/patients/search/advanced - Búsqueda avanzada
const searchPatientsAdvanced = async (req, res) => {
  try {
    const {
      diagnostic,
      dateFrom,
      dateTo,
      bloodType,
      allergies,
      chronicDiseases,
      search,
      page = 1,
      limit = 10
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Construir filtros
    const where = {
      role: 'PACIENTE' // Solo pacientes
    };

    // Filtro por diagnóstico
    if (diagnostic) {
      where.OR = [
        { 
          medicalRecordsAsPatient: {
            some: {
              diagnosis: {
                contains: diagnostic,
                mode: 'insensitive'
              }
            }
          }
        },
        {
          diagnosticsAsPatient: {
            some: {
              diagnosis: {
                contains: diagnostic,
                mode: 'insensitive'
              }
            }
          }
        }
      ];
    }

    // Filtro por rango de fechas
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    // Filtros médicos
    if (bloodType) {
      where.bloodType = {
        contains: bloodType,
        mode: 'insensitive'
      };
    }

    if (allergies) {
      where.allergies = {
        contains: allergies,
        mode: 'insensitive'
      };
    }

    if (chronicDiseases) {
      where.chronicDiseases = {
        contains: chronicDiseases,
        mode: 'insensitive'
      };
    }

    // Búsqueda general
    if (search) {
      const searchConditions = [
        { fullname: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { identificationNumber: { contains: search, mode: 'insensitive' } }
      ];
      
      where.OR = where.OR ? [...where.OR, ...searchConditions] : searchConditions;
    }

    // Ejecutar consulta
    const [patients, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          email: true,
          fullname: true,
          identificationNumber: true,
          phone: true,
          dateOfBirth: true,
          age: true,
          bloodType: true,
          allergies: true,
          chronicDiseases: true,
          emergencyContact: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          medicalRecordsAsPatient: {
            take: 3,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              diagnosis: true,
              description: true,
              createdAt: true,
              department: { select: { name: true } },
              doctor: { select: { fullname: true } }
            }
          },
          diagnosticsAsPatient: {
            take: 3,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              title: true,
              diagnosis: true,
              createdAt: true,
              doctor: { select: { fullname: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    return res.status(200).json({
      patients,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
        hasNext: parseInt(page) < Math.ceil(total / parseInt(limit)),
        hasPrev: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Error en búsqueda avanzada de pacientes:', error);
    return res.status(500).json({ 
      message: 'Error al buscar pacientes.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET /api/patients/:id - Obtener paciente por ID
const getPatientById = async (req, res) => {
  try {
    const { id } = req.params;
    const patientId = parseInt(id);

    if (isNaN(patientId)) {
      return res.status(400).json({ message: 'ID de paciente inválido.' });
    }

    const patient = await prisma.user.findUnique({
      where: { 
        id: patientId, 
        role: 'PACIENTE' 
      },
      select: {
        id: true,
        email: true,
        fullname: true,
        identificationNumber: true,
        phone: true,
        dateOfBirth: true,
        age: true,
        bloodType: true,
        allergies: true,
        chronicDiseases: true,
        emergencyContact: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        medicalRecordsAsPatient: {
          orderBy: { createdAt: 'desc' },
          include: {
            department: { select: { name: true } },
            doctor: { 
              select: { 
                fullname: true, 
                specialization: { select: { name: true } } 
              } 
            }
          }
        },
        diagnosticsAsPatient: {
          orderBy: { createdAt: 'desc' },
          include: {
            doctor: { 
              select: { 
                fullname: true, 
                specialization: { select: { name: true } } 
              } 
            },
            documents: {
              select: {
                id: true,
                filename: true,
                fileType: true,
                fileSize: true,
                uploadedAt: true
              }
            }
          }
        },
        appointmentsAsPatient: {
          orderBy: { date: 'desc' },
          include: {
            doctor: { 
              select: { 
                fullname: true, 
                specialization: { select: { name: true } } 
              } 
            }
          }
        }
      }
    });

    if (!patient) {
      return res.status(404).json({ message: 'Paciente no encontrado.' });
    }

    return res.status(200).json({ patient });

  } catch (error) {
    console.error('Error obteniendo paciente:', error);
    return res.status(500).json({ 
      message: 'Error al obtener el paciente.' 
    });
  }
};

module.exports = {
  searchPatientsAdvanced,
  getPatientById
};