// controllers/appointmentController.js
const AppointmentService = require('../services/AppointmentService');
const service = new AppointmentService();

// POST /api/appointments
async function create(req, res) {
  try {
    const { userId, doctorId, date, durationMinutes, reason, status } = req.body;
    const created = await service.createAppointment({ userId, doctorId, date, durationMinutes, reason, status });
    res.status(201).json({ success: true, message: 'Cita creada', data: created });
  } catch (error) {
    const msg = error.message || 'Error creando cita';
    const badRequest = msg.includes('obligatorios') || msg.includes('horario laboral') || msg.includes('solapamiento') || msg.includes('inválido');
    res.status(badRequest ? 400 : 500).json({ success: false, message: msg });
  }
}

// PUT /api/appointments/:id
async function update(req, res) {
  try {
    const { id } = req.params;
    const { date, durationMinutes, reason, status, doctorId } = req.body;
    const updated = await service.updateAppointment(id, { date, durationMinutes, reason, status, doctorId });
    res.status(200).json({ success: true, message: 'Cita actualizada', data: updated });
  } catch (error) {
    const msg = error.message || 'Error actualizando cita';
    const badRequest = msg.includes('no encontrada') || msg.includes('horario laboral') || msg.includes('solapamiento') || msg.includes('inválido') || msg.includes('12 horas');
    res.status(badRequest ? 400 : 500).json({ success: false, message: msg });
  }
}

// PATCH /api/appointments/:id/cancel
async function cancel(req, res) {
  try {
    const { id } = req.params;
    const cancelled = await service.cancelAppointment(id);
    res.status(200).json({ success: true, message: 'Cita cancelada', data: cancelled });
  } catch (error) {
    const msg = error.message || 'Error cancelando cita';
    const badRequest = msg.includes('no encontrada') || msg.includes('12 horas');
    res.status(badRequest ? 400 : 500).json({ success: false, message: msg });
  }
}

// GET /api/appointments/statuses
async function getStatuses(req, res) {
  const statuses = service.getAllowedStatuses();
  res.json({ success: true, data: statuses });
}

module.exports = { create, update, cancel, getStatuses };
