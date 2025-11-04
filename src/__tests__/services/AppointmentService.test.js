const mockPrisma = {
  appointment: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  // Añadir mocks mínimos para no interferir con otros tests que mockean la misma dependencia
  user: { findUnique: jest.fn() },
  diagnostic: { findUnique: jest.fn() },
  diagnosticDocument: { create: jest.fn() },
};

jest.doMock('../../config/database', () => mockPrisma);
// Evitar llamadas reales de notificaciones durante tests
jest.doMock('../../services/NotificationService', () => ({
  autoNotifyAppointment: jest.fn().mockResolvedValue({ success: true })
}));

const AppointmentService = require('../../services/AppointmentService');

describe('AppointmentService', () => {
  let service;

  beforeEach(() => {
    service = new AppointmentService();
    jest.clearAllMocks();
  });

  describe('createAppointment', () => {
    it('rechaza citas fuera de horario laboral', async () => {
      const now = new Date();
      const start = new Date(now);
      start.setHours(7, 30, 0, 0); // 07:30

      await expect(
        service.createAppointment({ userId: 1, doctorId: 2, date: start.toISOString(), reason: 'Control' })
      ).rejects.toThrow('horario laboral');

      expect(mockPrisma.appointment.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.appointment.create).not.toHaveBeenCalled();
    });

    it('rechaza si hay solapamiento con otra cita', async () => {
      const now = new Date();
      const start = new Date(now);
      start.setHours(10, 0, 0, 0);

      // Simula una existente a las 10:15
      const existing = new Date(start);
      existing.setMinutes(15);
      mockPrisma.appointment.findMany.mockResolvedValue([{ id: 99, date: existing }]);

      await expect(
        service.createAppointment({ userId: 1, doctorId: 2, date: start.toISOString(), reason: 'Control' })
      ).rejects.toThrow('solapamiento');
    });

    it('crea cita válida dentro de horario sin solapamiento', async () => {
      const now = new Date();
      const start = new Date(now);
      start.setHours(11, 0, 0, 0);

      mockPrisma.appointment.findMany.mockResolvedValue([]);
      mockPrisma.appointment.create.mockResolvedValue({ id: 1, userId: 1, doctorId: 2, date: start, status: 'PENDIENTE' });

      const result = await service.createAppointment({ userId: 1, doctorId: 2, date: start.toISOString(), reason: 'Control' });
      expect(result.id).toBe(1);
      expect(mockPrisma.appointment.create).toHaveBeenCalled();
    });
  });

  describe('updateAppointment', () => {
    it('bloquea modificaciones si faltan menos de 12h', async () => {
      const soon = new Date(Date.now() + 6 * 3600000);
      mockPrisma.appointment.findUnique.mockResolvedValue({ id: 7, date: soon, doctorId: 2 });

      await expect(service.updateAppointment(7, { reason: 'Cambio' })).rejects.toThrow('12 horas');
    });

    it('valida solapamiento al reprogramar', async () => {
      const far = new Date(Date.now() + 48 * 3600000);
      mockPrisma.appointment.findUnique.mockResolvedValue({ id: 7, date: far, doctorId: 2 });

      const newStart = new Date(far);
      newStart.setHours(10, 0, 0, 0);

      mockPrisma.appointment.findMany.mockResolvedValue([{ id: 8, date: new Date(newStart.getTime() + 10 * 60000) }]);

      await expect(service.updateAppointment(7, { date: newStart.toISOString() })).rejects.toThrow('solapamiento');
    });
  });
});
