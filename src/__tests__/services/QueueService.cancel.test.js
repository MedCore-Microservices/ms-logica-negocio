// Tests for QueueService.cancel

// Mock Prisma minimal implementation for queueTicket operations
const mockPrisma = {
  queueTicket: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn()
  }
};

jest.doMock('../../config/database', () => mockPrisma);

const QueueService = require('../../services/QueueService');

describe('QueueService.cancel', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new QueueService();
  });

  test('cancela ticket WAITING y devuelve lista WAITING actualizada con posiciones', async () => {
    const ticket = { id: 10, doctorId: 7, patientId: 42, status: 'WAITING', createdAt: new Date('2025-01-01T10:00:00Z') };
    const updated = { ...ticket, status: 'CANCELLED', cancelledAt: new Date().toISOString() };

    // Tickets remaining en espera para el doctor (ordenados por createdAt asc)
    const waitingTickets = [
      { id: 11, doctorId: 7, patientId: 50, status: 'WAITING', createdAt: new Date('2025-01-01T10:05:00Z') },
      { id: 12, doctorId: 7, patientId: 51, status: 'WAITING', createdAt: new Date('2025-01-01T10:10:00Z') }
    ];

    mockPrisma.queueTicket.findUnique.mockResolvedValueOnce(ticket);
    mockPrisma.queueTicket.update.mockResolvedValueOnce(updated);
    mockPrisma.queueTicket.findMany.mockResolvedValueOnce(waitingTickets);

    const res = await service.cancel(ticket.id);

    expect(mockPrisma.queueTicket.findUnique).toHaveBeenCalledWith({ where: { id: Number(ticket.id) }, include: { patient: true, doctor: true } });
    expect(mockPrisma.queueTicket.update).toHaveBeenCalled();
    expect(mockPrisma.queueTicket.findMany).toHaveBeenCalledWith({
      where: { doctorId: ticket.doctorId, status: 'WAITING' },
      orderBy: { createdAt: 'asc' },
      include: { patient: { select: { id: true, fullname: true } }, doctor: { select: { id: true, fullname: true } } }
    });

    expect(res.cancelled).toEqual(updated);
    expect(Array.isArray(res.waiting)).toBe(true);
    expect(res.waiting.length).toBe(2);
    expect(res.waiting[0].position).toBe(1);
    expect(res.waiting[1].position).toBe(2);
  });

  test('retorna 404 si no existe el ticket', async () => {
    mockPrisma.queueTicket.findUnique.mockResolvedValueOnce(null);

    await expect(service.cancel(9999)).rejects.toMatchObject({ message: 'Ticket no encontrado', status: 404 });
  });

  test('retorna 400 si el ticket ya está COMPLETED', async () => {
    const ticket = { id: 20, doctorId: 8, patientId: 60, status: 'COMPLETED' };
    mockPrisma.queueTicket.findUnique.mockResolvedValueOnce(ticket);

    await expect(service.cancel(ticket.id)).rejects.toMatchObject({ message: 'No se puede cancelar un ticket ya completado', status: 400 });
  });
});
