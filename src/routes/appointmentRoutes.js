// routes/appointmentRoutes.js
const express = require('express');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const controller = require('../controllers/appointmentController');

const router = express.Router();

const canManage = ['MEDICO', 'ADMINISTRADOR'];
const canCancel = ['MEDICO', 'ADMINISTRADOR', 'PACIENTE'];

// Crear una cita
router.post('/', authenticate, requireRole(canManage), controller.create);

// Actualizar una cita
router.put('/:id', authenticate, requireRole(canManage), controller.update);

// Cancelar una cita
router.patch('/:id/cancel', authenticate, requireRole(canCancel), controller.cancel);

// Estados permitidos
router.get('/meta/statuses', authenticate, controller.getStatuses);

module.exports = router;
