// routes/notificationRoutes.js
const express = require('express');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const controller = require('../controllers/notificationController');

const router = express.Router();

const canSend = ['MEDICO', 'ADMINISTRADOR'];
const canAuto = ['MEDICO', 'ADMINISTRADOR'];

// POST /api/notifications/send
router.post('/send', authenticate, requireRole(canSend), controller.send);

// POST /api/notifications/auto
router.post('/auto', authenticate, requireRole(canAuto), controller.auto);

module.exports = router;
