const express = require('express');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const controller = require('../controllers/prescriptionController');

const router = express.Router();

// Crear prescripción (solo MEDICO o ADMINISTRADOR)
router.post('/', authenticate, requireRole(['MEDICO', 'ADMINISTRADOR']), controller.create);

module.exports = router;
