// services/DocumentService.js
const prisma = require('../config/database');
const fs = require('fs');

class DocumentService {
  // Subir un documento médico
  async uploadDocument(patientId, diagnosticId, doctorId, file) {
    // Validar tipo de archivo
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error('Tipo de archivo no permitido. Solo se aceptan PDF, JPG y PNG.');
    }

    // Validar tamaño del archivo (10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error('El archivo excede el tamaño máximo permitido de 10MB.');
    }

    // Verificar que el paciente existe
    const patient = await prisma.user.findUnique({
      where: { id: parseInt(patientId), role: 'PACIENTE' }
    });
    if (!patient) {
      throw new Error('Paciente no encontrado.');
    }

    // Verificar que el diagnóstico existe y pertenece al paciente
    const diagnostic = await prisma.diagnostic.findUnique({
      where: { id: parseInt(diagnosticId), patientId: parseInt(patientId) }
    });
    if (!diagnostic) {
      throw new Error('Diagnóstico no encontrado o no pertenece al paciente especificado.');
    }

    // Crear el registro del documento
    const document = await prisma.diagnosticDocument.create({
      data: {
        diagnosticId: parseInt(diagnosticId),
        filename: file.originalname,
        storedFilename: file.filename,
        filePath: file.path,
        fileType: file.mimetype,
        mimeType: file.mimetype,
        fileSize: file.size,
        uploadedBy: parseInt(doctorId)
        // description se omite (es opcional)
      }
    });

    return document;
  }

  // Obtener todos los documentos de un paciente
  async getDocumentsByPatient(patientId) {
    const patient = await prisma.user.findUnique({
      where: { id: parseInt(patientId), role: 'PACIENTE' }
    });
    if (!patient) {
      throw new Error('Paciente no encontrado.');
    }

    const documents = await prisma.diagnosticDocument.findMany({
      where: {
        diagnostic: {
          patientId: parseInt(patientId)
        }
      },
      include: {
        diagnostic: {
          select: {
            id: true,
            title: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        uploadedAt: 'desc'
      }
    });

    return documents;
  }

  // Obtener un documento específico por ID
  async getDocumentById(documentId) {
    const document = await prisma.diagnosticDocument.findUnique({
      where: { id: parseInt(documentId) },
      include: {
        diagnostic: {
          select: {
            id: true,
            title: true,
            patientId: true
          }
        }
      }
    });

    if (!document) {
      throw new Error('Documento no encontrado.');
    }

    return document;
  }

  // Eliminar un documento
  async deleteDocument(documentId, userId) {
    const document = await prisma.diagnosticDocument.findUnique({
      where: { id: parseInt(documentId) },
      include: {
        diagnostic: {
          select: { patientId: true }
        }
      }
    });

    if (!document) {
      throw new Error('Documento no encontrado.');
    }

    // Verificar permisos: solo quien lo subió o un administrador
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) }
    });

    if (!user) {
      throw new Error('Usuario no encontrado.');
    }

    if (document.uploadedBy !== parseInt(userId) && user.role !== 'ADMINISTRADOR') {
      throw new Error('No tienes permiso para eliminar este documento.');
    }

    // Eliminar archivo físico
    if (fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }

    // Eliminar registro
    await prisma.diagnosticDocument.delete({
      where: { id: parseInt(documentId) }
    });

    return { success: true, message: 'Documento eliminado exitosamente.' };
  }
}

module.exports =DocumentService;