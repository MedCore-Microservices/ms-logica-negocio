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

// Crear orden de radiología - accesible para MEDICO, ENFERMERA y ADMINISTRADOR
router.post(
  '/radiology',
  authenticate,
  requireRole(['MEDICO', 'ENFERMERA', 'ADMINISTRADOR']),
  controller.createRadiologyOrder
);

// Obtener orden médica por id - autenticado (PACIENTE solo su propia orden)
router.get('/:id', authenticate, controller.getOrder);
module.exports = router;
