const fs = require('fs');

// 1. Primero definir los mocks
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  diagnostic: {
    findUnique: jest.fn(),
  },
  diagnosticDocument: {
    create: jest.fn(),
  },
};

const fsMock = {
  existsSync: jest.fn(),
  unlinkSync: jest.fn(),
};

// 2. Configurar los mocks ANTES de importar el servicio
jest.doMock('../../config/database', () => mockPrisma);

jest.doMock('fs', () => fsMock);

// 3. AHORA importar el servicio (después de configurar mocks)
const DocumentService = require('../../services/DocumentService');

describe('DocumentService', () => {
  let documentService;

  beforeEach(() => {
    documentService = new DocumentService();
    jest.clearAllMocks();
  });

  describe('uploadDocument', () => {
    it('should upload a document successfully', async () => {
      // Configurar mocks
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, role: 'PACIENTE' });
      mockPrisma.diagnostic.findUnique.mockResolvedValue({ id: 1, patientId: 1 });
      mockPrisma.diagnosticDocument.create.mockResolvedValue({ 
        id: 1, 
        filename: 'test.pdf' 
      });

      const file = {
        mimetype: 'application/pdf',
        size: 1024,
        originalname: 'test.pdf',
        filename: 'test123.pdf',
        path: '/uploads/test123.pdf'
      };

      const result = await documentService.uploadDocument(1, 1, 1, file);

      expect(result).toEqual({ id: 1, filename: 'test.pdf' });
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1, role: 'PACIENTE' }
      });
      expect(mockPrisma.diagnostic.findUnique).toHaveBeenCalledWith({
        where: { id: 1, patientId: 1 }
      });
      expect(mockPrisma.diagnosticDocument.create).toHaveBeenCalledWith({
        data: {
          diagnosticId: 1,
          filename: 'test.pdf',
          storedFilename: 'test123.pdf',
          filePath: '/uploads/test123.pdf',
          fileType: 'application/pdf',
          mimeType: 'application/pdf',
          fileSize: 1024,
          uploadedBy: 1
        }
      });
    });

    it('should throw an error for invalid file type', async () => {
      const file = { mimetype: 'text/plain', size: 1024 };

      await expect(documentService.uploadDocument(1, 1, 1, file))
        .rejects.toThrow('Tipo de archivo no permitido. Solo se aceptan PDF, JPG y PNG.');
    });

    it('should throw an error for file size exceeding limit', async () => {
      const file = { mimetype: 'application/pdf', size: 11 * 1024 * 1024 };

      await expect(documentService.uploadDocument(1, 1, 1, file))
        .rejects.toThrow('El archivo excede el tamaño máximo permitido de 10MB.');
    });

    it('should throw an error if patient is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const file = { mimetype: 'application/pdf', size: 1024 };

      await expect(documentService.uploadDocument(1, 1, 1, file))
        .rejects.toThrow('Paciente no encontrado.');
      
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1, role: 'PACIENTE' }
      });
    });

    it('should throw an error if diagnostic is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, role: 'PACIENTE' });
      mockPrisma.diagnostic.findUnique.mockResolvedValue(null);

      const file = { mimetype: 'application/pdf', size: 1024 };

      await expect(documentService.uploadDocument(1, 1, 1, file))
        .rejects.toThrow('Diagnóstico no encontrado o no pertenece al paciente especificado.');
      
      expect(mockPrisma.diagnostic.findUnique).toHaveBeenCalledWith({
        where: { id: 1, patientId: 1 }
      });
    });
  });
});