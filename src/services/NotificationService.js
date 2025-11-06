// services/NotificationService.js
const notificationsConfig = require('../config/notifications');
const prisma = require('../config/database');

class NotificationService {
  constructor() {
    this.mode = notificationsConfig.mode;
    this.twilioClient = null;

    if (this.mode === 'twilio') {
      const { accountSid, authToken } = notificationsConfig.twilio;
      if (accountSid && authToken) {
        try {
          // Requerir twilio solo si se usa modo real para evitar dependencia en tests
          // eslint-disable-next-line global-require
          const twilio = require('twilio');
          this.twilioClient = twilio(accountSid, authToken);
        } catch (err) {
          console.warn('[Notifications] Twilio no disponible, usando mock. Motivo:', err.message);
          this.mode = 'mock';
        }
      } else {
        console.warn('[Notifications] Credenciales Twilio faltantes, usando mock');
        this.mode = 'mock';
      }
    }
  }

  async sendSMS({ to, message }) {
    if (!to) {
      return { success: false, error: 'Número de destino requerido' };
    }
    if (!message) {
      return { success: false, error: 'Mensaje requerido' };
    }

    if (this.mode === 'mock') {
      console.log(`[MOCK SMS] to=${to} :: ${message}`);
      return { success: true, mode: 'mock' };
    }

    try {
      const { from } = notificationsConfig.twilio;
      const result = await this.twilioClient.messages.create({ from, to, body: message });
      return { success: true, sid: result.sid, mode: 'twilio' };
    } catch (error) {
      console.error('[Notifications] Error enviando SMS:', error);
      return { success: false, error: error.message };
    }
  }

  // Simulación de correo (no implementado proveedor real)
  async sendEmail({ to, subject, html }) {
    if (this.mode !== 'mock') {
      console.log('[Notifications] Email real no implementado, usando mock');
    }
    console.log(`[MOCK EMAIL] to=${to} :: subject=${subject} :: html=${html?.slice(0, 80)}...`);
    return { success: true, mode: 'mock' };
  }

  // Auto-notificación para citas: paciente y/o médico
  async autoNotifyAppointment(action, appointmentId) {
    try {
      const appt = await prisma.appointment.findUnique({
        where: { id: parseInt(appointmentId) },
        include: {
          user: { select: { id: true, fullname: true, phone: true } },
          doctor: { select: { id: true, fullname: true, phone: true } },
        }
      });
      if (!appt) return { success: false, error: 'Cita no encontrada' };

      const when = new Date(appt.date);
      const humanDate = when.toLocaleString();
      const baseMsg = `Cita ${action} para ${humanDate}. Motivo: ${appt.reason || ''}`;

      const results = [];
      if (appt.user?.phone) {
        results.push(await this.sendSMS({ to: appt.user.phone, message: `[Paciente] ${baseMsg}` }));
      }
      if (appt.doctor?.phone) {
        results.push(await this.sendSMS({ to: appt.doctor.phone, message: `[Médico] ${baseMsg}` }));
      }
      return { success: true, results };
    } catch (error) {
      console.error('[Notifications] Error auto-notify:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NotificationService();
