// routes/documentRoutes.js
const express = require('express');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const upload = require('../config/multer');
const {
  uploadDocument,
  getDocumentsByPatient,
  downloadDocument,
  deleteDocument
} = require('../controllers/DocumentController');

const router = express.Router();

const canManageDocs = ['MEDICO', 'ADMINISTRADOR'];
const canViewDocs = ['MEDICO', 'ADMINISTRADOR', 'PACIENTE'];

// POST /api/documents/upload?patientId=1&diagnosticId=2
router.post(
  '/upload',
  authenticate,
  requireRole(canManageDocs),
  upload.single('file'),
  uploadDocument
);

// GET /api/documents/patient/:patientId
router.get(
  '/patient/:patientId',
  authenticate,
  requireRole(canViewDocs),
  getDocumentsByPatient
);

// GET /api/documents/:id
router.get(
  '/:id',
  authenticate,
  requireRole(canViewDocs),
  downloadDocument
);

// DELETE /api/documents/:id
router.delete(
  '/:id',
  authenticate,
  requireRole(canManageDocs),
  deleteDocument
);

module.exports = router;