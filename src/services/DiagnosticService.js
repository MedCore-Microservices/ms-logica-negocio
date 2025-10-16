const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class DiagnosticService {
  async createDiagnostic(patientId, doctorId, diagnosticData, files) {
    return await prisma.$transaction(async (tx) => {
      // 1. Verificar que el paciente existe y está activo
      const patient = await tx.user.findUnique({
        where: { 
          id: parseInt(patientId),
          role: 'PACIENTE'
        }
      });

      if (!patient) {
        throw new Error('Paciente no encontrado');
      }

      if (patient.status !== 'ACTIVE') {
        throw new Error('No se puede crear diagnóstico para paciente inactivo');
      }

      // 2. Verificar que el doctor puede crear diagnósticos
      const doctor = await tx.user.findUnique({
        where: { 
          id: parseInt(doctorId),
          role: { in: ['MEDICO', 'ADMINISTRADOR'] }
        }
      });

      if (!doctor) {
        throw new Error('Solo médicos pueden crear diagnósticos');
      }

      // 3. Crear el diagnóstico
      const diagnostic = await tx.diagnostic.create({
        data: {
          patientId: parseInt(patientId),
          doctorId: parseInt(doctorId),
          title: diagnosticData.title,
          description: diagnosticData.description,
          symptoms: diagnosticData.symptoms,
          diagnosis: diagnosticData.diagnosis,
          treatment: diagnosticData.treatment,
          observations: diagnosticData.observations,
          nextAppointment: diagnosticData.nextAppointment ? 
            new Date(diagnosticData.nextAppointment) : null,
        }
      });

      // 4. Crear documentos si existen archivos
      if (files && files.length > 0) {
        const documentRecords = files.map(file => ({
          diagnosticId: diagnostic.id,
          filename: file.originalname,
          storedFilename: file.filename,
          filePath: file.path,
          fileType: file.mimetype,
          mimeType: file.mimetype,
          fileSize: file.size,
          uploadedBy: parseInt(doctorId)
        }));

        await tx.diagnosticDocument.createMany({
          data: documentRecords
        });
      }

      // 5. Devolver el diagnóstico completo
      return await tx.diagnostic.findUnique({
        where: { id: diagnostic.id },
        include: { 
          patient: {
            select: {
              id: true,
              fullname: true,
              email: true
            }
          },
          doctor: {
            select: {
              id: true,
              fullname: true,
              email: true
            }
          },
          documents: true
        }
      });
    });
  }
}

module.exports = new DiagnosticService();