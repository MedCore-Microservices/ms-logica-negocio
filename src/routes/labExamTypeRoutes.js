const express = require('express');
const controller = require('../controllers/labExamTypeController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Listar plantillas de órdenes de laboratorio - accesible para cualquier usuario autenticado
router.get('/', authenticate, controller.listLabExamTypes);

// Obtener plantilla por código (ej: HEMOGRAMA, ORINA)
router.get('/:code', authenticate, controller.getLabExamTypeByCode);

module.exports = router;
