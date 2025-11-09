// controllers/queueController.js
const QueueService = require('../services/QueueService');
const service = new QueueService();

// POST /api/queue/join
async function join(req, res) {
  try {
    const { doctorId, patientId } = req.body;
    const effectivePatientId = patientId || req.user?.id;
    const result = await service.join({ doctorId, patientId: effectivePatientId });
    res.status(201).json({ success: true, message: 'Ingresaste a la cola', data: result });
  } catch (error) {
    const status = error.status || (error.code === 'DUPLICATE_QUEUE' ? 409 : 400);
    res.status(status).json({ success: false, message: error.message, code: error.code });
  }
}

// GET /api/queue/doctor/:doctorId/current
async function current(req, res) {
  try {
    const { doctorId } = req.params;
    // Seguridad: si es MEDICO solo puede consultar su propio doctorId
    if (req.user?.role === 'MEDICO' && Number(doctorId) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, message: 'No autorizado para consultar otro médico' });
    }
    const current = await service.getCurrentForDoctor(doctorId);
    res.json({ success: true, data: current });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// POST /api/queue/call-next
async function callNext(req, res) {
  try {
    const { doctorId } = req.body;
    if (!doctorId) {
      return res.status(400).json({ success: false, message: 'doctorId es obligatorio' });
    }
    // Seguridad: si es MEDICO solo puede operar sobre su propio doctorId
    if (req.user?.role === 'MEDICO' && Number(doctorId) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, message: 'No autorizado para operar en otro médico' });
    }
    const next = await service.callNext(doctorId);
    res.status(200).json({ success: true, message: next ? 'Siguiente llamado' : 'No hay en espera', data: next });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

// PUT /api/queue/ticket/:ticketId/complete
async function complete(req, res) {
  try {
    const { ticketId } = req.params;
    const updated = await service.complete(ticketId);
    res.json({ success: true, message: 'Ticket completado', data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

// GET /api/queue/ticket/:ticketId/position
async function position(req, res) {
  try {
    const { ticketId } = req.params;
    const data = await service.position(ticketId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

// GET /api/queue/doctor/:doctorId/waiting
async function waiting(req, res) {
  try {
    const { doctorId } = req.params;
    // Seguridad: si es MEDICO solo puede consultar su propio doctorId
    if (req.user?.role === 'MEDICO' && Number(doctorId) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, message: 'No autorizado para consultar otro médico' });
    }
    const data = await service.getWaitingForDoctor(doctorId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

module.exports = { join, current, callNext, complete, position, waiting };
