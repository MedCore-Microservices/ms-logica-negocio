const prisma = require('../config/database');

// GET /api/patients/search/advanced - Búsqueda avanzada
const searchPatientsAdvanced = async (req, res) => {
  try {
    const {
      diagnostic,
      dateFrom,
      dateTo,
      gender,
      minAge,
      maxAge,
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
      if (dateFrom) {
        const d = new Date(dateFrom);
        if (!isNaN(d)) where.createdAt.gte = d;
      }
      if (dateTo) {
        // Hacer inclusive el 'hasta' poniendo el final del día
        const d = new Date(dateTo);
        if (!isNaN(d)) {
          d.setHours(23, 59, 59, 999);
          where.createdAt.lte = d;
        }
      }
    }

    // Filtro por edad (min/max): soportar tanto `dateOfBirth` como campo `age`.
    // Convertimos min/max a cutoffs en dateOfBirth y/o creamos condiciones sobre el campo `age`.
    const today = new Date();
    let ageDateCondition = null;
    let ageNumberCondition = null;

    if (minAge || maxAge) {
      // Construir condición sobre dateOfBirth
      const dobCond = {};
      if (minAge) {
        const min = parseInt(minAge);
        if (!isNaN(min)) {
          const cutoffMax = new Date(today);
          cutoffMax.setFullYear(cutoffMax.getFullYear() - min);
          cutoffMax.setHours(23, 59, 59, 999);
          dobCond.lte = cutoffMax;
        }
      }
      if (maxAge) {
        const max = parseInt(maxAge);
        if (!isNaN(max)) {
          const cutoffMin = new Date(today);
          cutoffMin.setFullYear(cutoffMin.getFullYear() - max);
          cutoffMin.setHours(0, 0, 0, 0);
          dobCond.gte = cutoffMin;
        }
      }

      if (Object.keys(dobCond).length) ageDateCondition = { dateOfBirth: dobCond };

      // Construir condición sobre campo age (número)
      const numCond = {};
      if (minAge) {
        const min = parseInt(minAge);
        if (!isNaN(min)) numCond.gte = min;
      }
      if (maxAge) {
        const max = parseInt(maxAge);
        if (!isNaN(max)) numCond.lte = max;
      }
      if (Object.keys(numCond).length) ageNumberCondition = { age: numCond };

      // Combinar: queremos que el usuario cumpla al menos una de las condiciones (dateOfBirth OR age)
      const orConditions = [];
      if (ageDateCondition) orConditions.push(ageDateCondition);
      if (ageNumberCondition) orConditions.push(ageNumberCondition);

      if (orConditions.length === 1) {
        // Solo una fuente de datos: añadirla directamente
        Object.assign(where, orConditions[0]);
      } else if (orConditions.length > 1) {
        // Ambas fuentes: añadir como AND + OR para no romper otros filtros
        where.AND = where.AND || [];
        where.AND.push({ OR: orConditions });
      }
    }

    // Filtro por género
    if (gender) {
      where.gender = { equals: String(gender), mode: 'insensitive' };
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
          gender: true,
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
          gender: true,
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

// Crear paciente
const createPatient = async (req, res) => {
  try {
    const data = req.body;

    // validar datos mínimos
    if (!data.fullname || !data.identificationNumber) {
      return res.status(400).json({ message: 'fullname e identificationNumber son requeridos' });
    }

    // calcular edad si dateOfBirth está presente y no se envía age
    let calculatedAge = null;
    if (data.dateOfBirth && !data.age) {
      const dob = new Date(data.dateOfBirth);
      if (!isNaN(dob)) {
        const diff = Date.now() - dob.getTime();
        const ageDt = new Date(diff);
        calculatedAge = Math.abs(ageDt.getUTCFullYear() - 1970);
      }
    }

    const created = await prisma.user.create({
      data: {
        fullname: data.fullname,
        identificationNumber: data.identificationNumber,
        email: data.email || null,
        phone: data.phone || null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        age: data.age || calculatedAge || null,
        gender: data.gender || null,
        bloodType: data.bloodType || null,
        allergies: data.allergies || null,
        chronicDiseases: data.chronicDiseases || null,
        emergencyContact: data.emergencyContact || null,
        role: 'PACIENTE',
        status: data.status || 'ACTIVE'
      }
    });

    return res.status(201).json({ patient: created });

  } catch (error) {
    console.error('Error creando paciente:', error);
    return res.status(500).json({ message: 'Error creando paciente.' });
  }
};

// Actualizar paciente
const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const patientId = parseInt(id);
    if (isNaN(patientId)) return res.status(400).json({ message: 'ID inválido' });

    const data = req.body;

    const updated = await prisma.user.update({
      where: { id: patientId },
      data: {
        fullname: data.fullname,
        identificationNumber: data.identificationNumber,
        email: data.email,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        // calcular age si se envía dateOfBirth y no age
        age: data.age !== undefined ? data.age : (data.dateOfBirth ? (() => {
          const dob = new Date(data.dateOfBirth);
          if (!isNaN(dob)) {
            const diff = Date.now() - dob.getTime();
            const ageDt = new Date(diff);
            return Math.abs(ageDt.getUTCFullYear() - 1970);
          }
          return undefined;
        })() : undefined),
        gender: data.gender,
        bloodType: data.bloodType,
        allergies: data.allergies,
        chronicDiseases: data.chronicDiseases,
        emergencyContact: data.emergencyContact,
        status: data.status
      }
    });

    return res.status(200).json({ patient: updated });
  } catch (error) {
    console.error('Error actualizando paciente:', error);
    return res.status(500).json({ message: 'Error actualizando paciente.' });
  }
};

module.exports = {
  searchPatientsAdvanced,
  getPatientById,
  createPatient,
  updatePatient
};