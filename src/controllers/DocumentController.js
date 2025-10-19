// controllers/DocumentController.js
const documentService = require('../services/DocumentService');
const fs = require('fs');

const uploadDocument = async (req, res) => {
  let file = req.file;

  try {
    const { patientId, diagnosticId } = req.query; // ⚠️ Cambiado a query params
    const doctorId = req.user.id;

    if (!patientId || !diagnosticId) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren los parámetros patientId y diagnosticId en la URL.'
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un archivo para subir.'
      });
    }

    const document = await documentService.uploadDocument(
      patientId,
      diagnosticId,
      doctorId,
      file
    );

    res.status(201).json({
      success: true,
      message: 'Documento subido exitosamente.',
      data: document
    });

  } catch (error) {
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    console.error('Error subiendo documento:', error);

    if (error.message.includes('Tipo de archivo') ||
        error.message.includes('tamaño máximo') ||
        error.message.includes('Paciente no encontrado') ||
        error.message.includes('Diagnóstico no encontrado')) {
      return res.status(400).json({ success: false, message: error.message });
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al subir el documento.'
    });
  }
};

const getDocumentsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const documents = await documentService.getDocumentsByPatient(patientId);
    res.status(200).json({ success: true, message: 'Documentos obtenidos.', data: documents });
  } catch (error) {
    console.error('Error obteniendo documentos:', error);
    if (error.message.includes('Paciente no encontrado')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Error al obtener documentos.' });
  }
};

const downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await documentService.getDocumentById(id);

    if (!fs.existsSync(document.filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Archivo no encontrado en el servidor.'
      });
    }

    res.download(document.filePath, document.filename);
  } catch (error) {
    console.error('Error descargando documento:', error);
    if (error.message.includes('Documento no encontrado')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Error al descargar el documento.' });
  }
};

const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await documentService.deleteDocument(id, userId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error eliminando documento:', error);
    if (error.message.includes('Documento no encontrado') ||
        error.message.includes('No tienes permiso')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Error al eliminar el documento.' });
  }
};

module.exports = {
  uploadDocument,
  getDocumentsByPatient,
  downloadDocument,
  deleteDocument
};