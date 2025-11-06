// services/AppointmentService.js
const prisma = require('../config/database');
const notificationsConfig = require('../config/notifications');
const NotificationService = require('./NotificationService');

// Constantes de negocio
const WORK_START_HOUR = 8;   // 08:00
const WORK_END_HOUR = 18;    // 18:00
const DEFAULT_SLOT_MINUTES = 30;
const MODIFICATION_CUTOFF_HOURS = 12;

// Estados permitidos (en español)
const APPOINTMENT_STATUS = {
  PENDIENTE: 'PENDIENTE',
  CONFIRMADA: 'CONFIRMADA',
  CANCELADA: 'CANCELADA',
  COMPLETADA: 'COMPLETADA',
};

// Utilidades de tiempo
function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function isWithinWorkingHours(start, end) {
  // Usa zona horaria del servidor; asume entrada en ISO o Date
  const startLocal = new Date(start);
  const endLocal = new Date(end);

  // Mismo día para una cita
  if (
    startLocal.getFullYear() !== endLocal.getFullYear() ||
    startLocal.getMonth() !== endLocal.getMonth() ||
    startLocal.getDate() !== endLocal.getDate()
  ) {
    return false; // No permitimos que cruce de día
  }

  const startHour = startLocal.getHours() + startLocal.getMinutes() / 60;
  const endHour = endLocal.getHours() + endLocal.getMinutes() / 60;

  return startHour >= WORK_START_HOUR && endHour <= WORK_END_HOUR && endHour > startHour;
}

function hoursUntil(date) {
  const now = new Date();
  const diffMs = new Date(date).getTime() - now.getTime();
  return diffMs / 3600000; // horas
}

class AppointmentService {
  getAllowedStatuses() {
    return { ...APPOINTMENT_STATUS };
  }

  // Calcula fin en base a duración (por defecto 30m)
  computeEnd(startDate, durationMinutes) {
    return addMinutes(new Date(startDate), durationMinutes || DEFAULT_SLOT_MINUTES);
  }

  async hasOverlap(doctorId, startDate, endDate, ignoreAppointmentId) {
    // Como el esquema solo guarda `date` (inicio), asumimos slot fijo de 30m para existentes
    // Buscamos citas del mismo médico en un rango que pueda solaparse
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Traemos posibles citas del día del start (para reducir carga)
    const dayStart = new Date(start);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(start);
    dayEnd.setHours(23, 59, 59, 999);

    const existing = await prisma.appointment.findMany({
      where: {
        doctorId: parseInt(doctorId),
        date: { gte: dayStart, lte: dayEnd },
        // Excluir canceladas conocidas (en inglés o español, por compatibilidad)
        NOT: {
          status: { in: ['CANCELLED', APPOINTMENT_STATUS.CANCELADA] }
        }
      },
      select: { id: true, date: true }
    });

    return existing.some((appt) => {
      if (ignoreAppointmentId && appt.id === parseInt(ignoreAppointmentId)) return false;
      const apptStart = new Date(appt.date);
      const apptEnd = addMinutes(apptStart, DEFAULT_SLOT_MINUTES);
      // Overlap si start < apptEnd y end > apptStart
      return start < apptEnd && end > apptStart;
    });
  }

  async createAppointment({ userId, doctorId, date, durationMinutes, reason, status }) {
    if (!userId || !doctorId || !date || !reason) {
      throw new Error('userId, doctorId, date y reason son obligatorios');
    }

    const start = new Date(date);
    const end = this.computeEnd(start, durationMinutes);

    if (!isWithinWorkingHours(start, end)) {
      throw new Error('La cita debe estar dentro del horario laboral (08:00 - 18:00)');
    }

    const overlaps = await this.hasOverlap(doctorId, start, end);
    if (overlaps) {
      throw new Error('El médico no está disponible en ese horario (solapamiento)');
    }

    // Validar estado
    const newStatus = status || APPOINTMENT_STATUS.PENDIENTE;
    if (!Object.values(APPOINTMENT_STATUS).includes(newStatus)) {
      throw new Error('Estado de cita inválido');
    }

    const created = await prisma.appointment.create({
      data: {
        userId: parseInt(userId),
        doctorId: parseInt(doctorId),
        date: start, // Guardamos solo inicio por esquema actual
        reason,
        status: newStatus,
      }
    });
    // Notificar automáticamente (best-effort)
    if (notificationsConfig.auto) {
      try {
        await NotificationService.autoNotifyAppointment('creada', created.id);
      } catch (e) {
        console.warn('[Appointment] Notificación falló (create):', e.message);
      }
    }
    return created;
  }

  async updateAppointment(appointmentId, { date, durationMinutes, reason, status, doctorId }) {
    const appt = await prisma.appointment.findUnique({ where: { id: parseInt(appointmentId) } });
    if (!appt) throw new Error('Cita no encontrada');

    // Regla: solo modificar hasta 12h antes
    if (hoursUntil(appt.date) < MODIFICATION_CUTOFF_HOURS) {
      throw new Error('Las citas solo pueden modificarse hasta 12 horas antes');
    }

    // Si cambia fecha o doctor, validar disponibilidad y horario
    let start = date ? new Date(date) : new Date(appt.date);
    const end = this.computeEnd(start, durationMinutes);

    if (!isWithinWorkingHours(start, end)) {
      throw new Error('La cita debe estar dentro del horario laboral (08:00 - 18:00)');
    }

    const targetDoctorId = doctorId ? parseInt(doctorId) : appt.doctorId;
    const overlaps = await this.hasOverlap(targetDoctorId, start, end, appt.id);
    if (overlaps) {
      throw new Error('El médico no está disponible en ese horario (solapamiento)');
    }

    const data = {};
    if (date) data.date = start;
    if (reason) data.reason = reason;
    if (doctorId) data.doctorId = targetDoctorId;
    if (status) {
      if (!Object.values(APPOINTMENT_STATUS).includes(status)) {
        throw new Error('Estado de cita inválido');
      }
      data.status = status;
    }

    const updated = await prisma.appointment.update({
      where: { id: appt.id },
      data,
    });
    if (notificationsConfig.auto) {
      try {
        await NotificationService.autoNotifyAppointment('actualizada', updated.id);
      } catch (e) {
        console.warn('[Appointment] Notificación falló (update):', e.message);
      }
    }
    return updated;
  }

  async cancelAppointment(appointmentId) {
    const appt = await prisma.appointment.findUnique({ where: { id: parseInt(appointmentId) } });
    if (!appt) throw new Error('Cita no encontrada');

    if (hoursUntil(appt.date) < MODIFICATION_CUTOFF_HOURS) {
      throw new Error('Las citas solo pueden modificarse hasta 12 horas antes');
    }

    const cancelled = await prisma.appointment.update({
      where: { id: appt.id },
      data: { status: APPOINTMENT_STATUS.CANCELADA }
    });
    if (notificationsConfig.auto) {
      try {
        await NotificationService.autoNotifyAppointment('cancelada', cancelled.id);
      } catch (e) {
        console.warn('[Appointment] Notificación falló (cancel):', e.message);
      }
    }
    return cancelled;
  }
}

module.exports = AppointmentService;
