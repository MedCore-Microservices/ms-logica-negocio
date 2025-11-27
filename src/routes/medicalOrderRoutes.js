const express = require('express');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const controller = require('../controllers/medicalOrderController');

const router = express.Router();

// Crear orden de laboratorio - accesible para MEDICO, ENFERMERA y ADMINISTRADOR
router.post(
  '/laboratory',
  authenticate,
  requireRole(['MEDICO', 'ENFERMERA', 'ADMINISTRADOR']),
  controller.createLaboratoryOrder
);

module.exports = router;
