const PrescriptionService = require('../services/PrescriptionService');
const service = new PrescriptionService();

// POST /api/prescriptions
async function create(req, res) {
  try {
    // Permitir que el token defina el doctor si es rol MEDICO
    const user = req.user || {};
    const role = (user.role || '').toUpperCase();
    const doctorId = role === 'MEDICO' ? user.id : req.body.doctorId;

    if (!doctorId) {
      return res.status(403).json({ success: false, message: 'doctorId requerido o token de médico' });
    }

    const { patientId, title, notes, medications } = req.body;

    const created = await service.createPrescription({ doctorId, patientId, title, notes, medications });
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    const status = error.status || 400;
    return res.status(status).json({ success: false, message: error.message });
  }
}

module.exports = { create };
