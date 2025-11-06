// controllers/notificationController.js
const notificationService = require('../services/NotificationService');
const notificationsConfig = require('../config/notifications');

async function send(req, res) {
  try {
    const { channel, to, message, subject, html } = req.body;
    if (!channel) return res.status(400).json({ success: false, message: 'channel requerido: sms|email' });

    let result;
    if (channel === 'sms') {
      result = await notificationService.sendSMS({ to, message });
    } else if (channel === 'email') {
      result = await notificationService.sendEmail({ to, subject, html });
    } else {
      return res.status(400).json({ success: false, message: 'channel inválido (sms|email)' });
    }

    const status = result.success ? 200 : 400;
    return res.status(status).json({ success: result.success, mode: notificationsConfig.mode, data: result });
  } catch (error) {
    console.error('notifications/send error:', error);
    return res.status(500).json({ success: false, message: 'Error enviando notificación' });
  }
}

async function auto(req, res) {
  try {
    const { action, appointmentId } = req.body;
    if (!action || !appointmentId) {
      return res.status(400).json({ success: false, message: 'action y appointmentId son requeridos' });
    }

    const result = await notificationService.autoNotifyAppointment(action, appointmentId);
    const status = result.success ? 200 : 400;
    return res.status(status).json({ success: result.success, data: result });
  } catch (error) {
    console.error('notifications/auto error:', error);
    return res.status(500).json({ success: false, message: 'Error en auto notificación' });
  }
}

module.exports = { send, auto };
