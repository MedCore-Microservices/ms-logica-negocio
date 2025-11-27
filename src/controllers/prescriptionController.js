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

// GET /api/prescriptions/patient/:patientId
async function getByPatient(req, res) {
  try {
    const { patientId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;

    // Permisos: si es PACIENTE solo puede consultar su propio historial
    if (req.user?.role === 'PACIENTE' && Number(req.user.id) !== Number(patientId)) {
      return res.status(403).json({ success: false, message: 'No autorizado para consultar otro paciente' });
    }

    const data = await service.getByPatient(patientId, { limit, offset });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { create, getByPatient };
