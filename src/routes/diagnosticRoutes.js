const express = require('express');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const upload = require('../config/multer');
const { createDiagnostic } = require('../controllers/DiagnosticController');

const router = express.Router();


// RUTA DE PRUEBA - Verificar conexión con ms-auth
router.get('/test-connection', authenticate, (req, res) => {
  res.json({
    success: true,
    message: 'Conexión exitosa con ms-auth!',
    user: req.user
  });
});
// Ruta para crear diagnóstico - Solo médicos pueden acceder
router.post(
  '/patients/:patientId/diagnostics',
  authenticate,
  requireRole(['MEDICO', 'ADMINISTRADOR']),
  upload.array('documents', 5), // Hasta 5 archivos
  createDiagnostic
);

module.exports = router;