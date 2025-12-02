const express = require('express');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const controller = require('../controllers/medicalOrderController');

const router = express.Router();

// Obtener todas las órdenes - solo para staff (MEDICO, ENFERMERA, ADMINISTRADOR)
router.get(
  '/',
  authenticate,
  requireRole(['MEDICO', 'ENFERMERA', 'ADMINISTRADOR']),
  controller.getAllOrders
);

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

// Obtener órdenes de un paciente (paginadas) - autenticado (PACIENTE solo su propia lista)
router.get('/patient/:patientId', authenticate, controller.getOrdersByPatient);
module.exports = router;
