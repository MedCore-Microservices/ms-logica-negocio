const PrescriptionService = require('../services/PrescriptionService');
const service = new PrescriptionService();

// POST /api/prescriptions
async function create(req, res) {
  try {
    // Permitir que el token defina el doctor si es rol MEDICO
    const user = req.user || {};
    const role = (user.role || '').toUpperCase();
    const body = req.body || {};
    const doctorId = role === 'MEDICO' ? user.id : body.doctorId;

    if (!doctorId) {
      return res.status(403).json({ success: false, message: 'doctorId requerido o token de médico' });
    }

    const { patientId, title, notes, medications } = body;

    if (!patientId) {
      return res.status(400).json({ success: false, message: 'patientId es requerido' });
    }

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

// POST /api/prescriptions/check-allergies
async function checkAllergies(req, res) {
  try {
    const body = req.body || {};
    const { patientId } = body;
    const role = (req.user?.role || '').toUpperCase();
    let medications = body.medications || body.meds || body.medication || body.medicamentos;

    // Reglas por rol:
    // - PACIENTE: puede omitir patientId y se usa su id del token
    // - MEDICO: debe enviar patientId explícito (no puede omitirse)
    // - Otros/anon: deben enviar patientId
    if (role === 'MEDICO' && !patientId) {
      return res.status(400).json({ success: false, message: 'Los médicos deben enviar patientId explícito' });
    }

    const resolvedPatientId = patientId || (role === 'PACIENTE' ? req.user?.id : undefined);

    if (!resolvedPatientId) {
      return res.status(400).json({ success: false, message: 'patientId es requerido' });
    }

    // Normalizar distintos formatos aceptables de "medications"
    if (typeof medications === 'string') {
      // intentar parsear JSON si viene como string
      try {
        const parsed = JSON.parse(medications);
        medications = parsed;
      } catch (e) {
        // si no es JSON, intentar separar por comas
        medications = medications.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    if (!medications || (Array.isArray(medications) && medications.length === 0) || (!Array.isArray(medications))) {
      // si no es array, intentar envolver en array si es un valor escalar
      if (medications && !Array.isArray(medications)) {
        medications = [medications];
      }
    }

    if (!medications || !Array.isArray(medications) || medications.length === 0) {
      return res.status(400).json({ success: false, message: 'medications es requerido y debe ser un array no vacío' });
    }

    // Permisos: paciente puede consultar su propia info
    if (role === 'PACIENTE' && Number(req.user.id) !== Number(resolvedPatientId)) {
      return res.status(403).json({ success: false, message: 'No autorizado para consultar otro paciente' });
    }

    const data = await service.checkAllergies(resolvedPatientId, medications);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    const status = error.status || 400;
    return res.status(status).json({ success: false, message: error.message });
  }
}

module.exports = { create, getByPatient, checkAllergies };
