const express = require('express');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const {
  searchPatientsAdvanced,
  getPatientById
} = require('../controllers/patientController');

const router = express.Router(); 

// Solo personal médico puede acceder
const canAccessPatients = ['ADMINISTRADOR', 'MEDICO', 'ENFERMERA'];

// GET /api/patients/search/advanced - Búsqueda avanzada
router.get('/search/advanced', authenticate, requireRole(canAccessPatients), searchPatientsAdvanced);

// GET /api/patients/:id - Obtener paciente por ID
router.get('/:id', authenticate, requireRole(canAccessPatients), getPatientById);

module.exports = router;