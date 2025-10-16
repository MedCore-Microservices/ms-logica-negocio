const diagnosticService = require('../services/DiagnosticService');
const fs = require('fs');

const createDiagnostic = async (req, res) => {
  let files = req.files || [];
  
  try {
    const { patientId } = req.params;
    const doctorId = req.user.id;

    // Validar campos obligatorios
    const { title, description, symptoms, diagnosis, treatment } = req.body;
    
    if (!title || !description || !symptoms || !diagnosis || !treatment) {
      // Limpiar archivos subidos si hay error
      cleanUpFiles(files);
      
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios',
        required: {
          title: 'Título del diagnóstico',
          description: 'Descripción del caso',
          symptoms: 'Síntomas presentados',
          diagnosis: 'Diagnóstico médico',
          treatment: 'Tratamiento prescrito'
        }
      });
    }

    // Crear el diagnóstico
    const diagnostic = await diagnosticService.createDiagnostic(
      patientId,
      doctorId,
      req.body,
      files
    );

    res.status(201).json({
      success: true,
      message: 'Diagnóstico creado exitosamente',
      data: diagnostic
    });

  } catch (error) {
    // Limpiar archivos en caso de error
    cleanUpFiles(files);
    
    console.error('Error creando diagnóstico:', error);
    
    // Manejar errores específicos
    if (error.message.includes('Paciente no encontrado') || 
        error.message.includes('Solo médicos pueden crear')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al crear diagnóstico'
    });
  }
};

// Función para limpiar archivos subidos
function cleanUpFiles(files) {
  if (files && files.length > 0) {
    files.forEach(file => {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });
  }
}

module.exports = { createDiagnostic };