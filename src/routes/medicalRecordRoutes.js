const express = require('express');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const {
  createMedicalRecord,
  getMedicalRecordsByPatient,
  updateMedicalRecord,
  getMedicalRecordTimeline
} = require('../controllers/medicalRecordController');

const router = express.Router();

// Roles permitidos para acceder a las historias clínicas
const canAccessMedicalRecords = ['ADMINISTRADOR', 'MEDICO'];

// POST /api/medical-records - Crear historia clínica
router.post('/', authenticate, requireRole(canAccessMedicalRecords), createMedicalRecord);

// GET /api/medical-records/patient/:patientId - Obtener historial
router.get('/patient/:patientId', authenticate, requireRole(canAccessMedicalRecords), getMedicalRecordsByPatient);

// PUT /api/medical-records/:id - Actualizar registro
router.put('/:id', authenticate, requireRole(canAccessMedicalRecords), updateMedicalRecord);

// GET /api/medical-records/:id/timeline - Timeline del paciente
router.get('/:id/timeline', authenticate, requireRole(canAccessMedicalRecords), getMedicalRecordTimeline);

module.exports = router;