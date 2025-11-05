// services/QueueService.js
const prisma = require('../config/database');

const STATUS = {
  WAITING: 'WAITING',
  CALLED: 'CALLED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

class QueueService {
  getStatuses() {
    return { ...STATUS };
  }

  async getPosition(ticket) {
    if (!ticket) return null;
    if (ticket.status !== STATUS.WAITING) return 0; // ya llamado o completado
    const ahead = await prisma.queueTicket.count({
      where: {
        doctorId: ticket.doctorId,
        status: STATUS.WAITING,
        createdAt: { lt: ticket.createdAt },
      },
    });
    return ahead + 1; // posición 1-based
  }

  async join({ doctorId, patientId }) {
    if (!doctorId || !patientId) {
      throw new Error('doctorId y patientId son obligatorios');
    }

    // Si ya está esperando en esa cola, devolver el mismo ticket con posición
    const existing = await prisma.queueTicket.findFirst({
      where: { doctorId: Number(doctorId), patientId: Number(patientId), status: STATUS.WAITING },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      const position = await this.getPosition(existing);
      return { ticket: existing, position };
    }

    const ticket = await prisma.queueTicket.create({
      data: {
        doctorId: Number(doctorId),
        patientId: Number(patientId),
        status: STATUS.WAITING,
      },
    });
    const position = await this.getPosition(ticket);
    return { ticket, position };
  }

  async getCurrentForDoctor(doctorId) {
    const current = await prisma.queueTicket.findFirst({
      where: { doctorId: Number(doctorId), status: STATUS.CALLED },
      orderBy: { calledAt: 'desc' },
    });
    return current || null;
  }

  async callNext(doctorId) {
    if (!doctorId) throw new Error('doctorId es obligatorio');

    return await prisma.$transaction(async (tx) => {
      // Tomar el primer WAITING por createdAt asc
      const next = await tx.queueTicket.findFirst({
        where: { doctorId: Number(doctorId), status: STATUS.WAITING },
        orderBy: { createdAt: 'asc' },
      });

      if (!next) return null;

      // Intentar marcarlo como CALLED sólo si sigue en WAITING (evitar carreras)
      const updated = await tx.queueTicket.updateMany({
        where: { id: next.id, status: STATUS.WAITING },
        data: { status: STATUS.CALLED, calledAt: new Date() },
      });

      if (updated.count !== 1) {
        // Otro proceso se adelantó; volver a intentar recursivamente una vez
        const retry = await tx.queueTicket.findFirst({
          where: { doctorId: Number(doctorId), status: STATUS.WAITING },
          orderBy: { createdAt: 'asc' },
        });
        if (!retry) return null;
        await tx.queueTicket.update({
          where: { id: retry.id },
          data: { status: STATUS.CALLED, calledAt: new Date() },
        });
        return retry;
      }

      return await tx.queueTicket.findUnique({ where: { id: next.id } });
    });
  }

  async complete(ticketId) {
    const t = await prisma.queueTicket.findUnique({ where: { id: Number(ticketId) } });
    if (!t) throw new Error('Ticket no encontrado');

    const updated = await prisma.queueTicket.update({
      where: { id: t.id },
      data: { status: STATUS.COMPLETED, completedAt: new Date() },
    });
    return updated;
  }

  async position(ticketId) {
    const t = await prisma.queueTicket.findUnique({ where: { id: Number(ticketId) } });
    if (!t) throw new Error('Ticket no encontrado');
    const position = await this.getPosition(t);
    return { ticket: t, position };
  }
}

module.exports = QueueService;
