const express = require('express');
const controller = require('../controllers/radiologyExamTypeController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

// Listar plantillas de radiología - autenticado
router.get('/', authenticate, controller.listRadiologyExamTypes);

// Obtener plantilla de radiología por código
router.get('/:code', authenticate, controller.getRadiologyExamTypeByCode);

module.exports = router;
