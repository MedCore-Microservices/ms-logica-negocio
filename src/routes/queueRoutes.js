// routes/queueRoutes.js
const express = require('express');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const controller = require('../controllers/queueController');

const router = express.Router();

const canCallOrComplete = ['MEDICO', 'ADMINISTRADOR'];

// Unirse a la cola (paciente por defecto es el usuario autenticado)
router.post('/join', authenticate, controller.join);

// Obtener el ticket actual llamado para un médico
router.get('/doctor/:doctorId/current', authenticate, controller.current);

// Llamar al siguiente de la cola (solo médico o admin)
router.post('/call-next', authenticate, requireRole(canCallOrComplete), controller.callNext);

// Completar un ticket (solo médico o admin)
router.put('/ticket/:ticketId/complete', authenticate, requireRole(canCallOrComplete), controller.complete);

// Ver posición de un ticket
router.get('/ticket/:ticketId/position', authenticate, controller.position);

module.exports = router;
