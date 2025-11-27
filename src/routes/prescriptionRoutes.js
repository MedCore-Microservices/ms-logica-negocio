const express = require('express');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const controller = require('../controllers/prescriptionController');

const router = express.Router();

// Crear prescripción (solo MEDICO o ADMINISTRADOR)
router.post('/', authenticate, requireRole(['MEDICO', 'ADMINISTRADOR']), controller.create);

// Historial de prescripciones por paciente
// Autenticado: paciente puede ver su propio historial; MEDICO/ADMINISTRADOR pueden ver cualquiera
router.get('/patient/:patientId', authenticate, controller.getByPatient);

// Verificar alergias: body { patientId, medications }
router.post('/check-allergies', authenticate, controller.checkAllergies);

// Estimar duración del tratamiento para una lista de medicamentos (body.medications)
router.post('/estimate-duration', authenticate, controller.estimateDuration);

module.exports = router;
