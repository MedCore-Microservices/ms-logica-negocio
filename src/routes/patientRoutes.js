const express = require('express');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const {
  searchPatientsAdvanced,
  getPatientById
  , createPatient, updatePatient
} = require('../controllers/patientController');

const router = express.Router(); 

// Solo personal médico puede acceder
const canAccessPatients = ['ADMINISTRADOR', 'MEDICO', 'ENFERMERA', 'PACIENTE'];//se agrega paciente para pruebas

// GET /api/patients/search/advanced - Búsqueda avanzada
router.get('/search/advanced', authenticate, requireRole(canAccessPatients), searchPatientsAdvanced);

// GET /api/patients/:id - Obtener paciente por ID
router.get('/:id', authenticate, requireRole(canAccessPatients), getPatientById);

// POST /api/patients - Crear paciente
router.post('/', authenticate, requireRole(canAccessPatients), createPatient);

// PUT /api/patients/:id - Actualizar paciente
router.put('/:id', authenticate, requireRole(canAccessPatients), updatePatient);

module.exports = router;