const medicalOrderService = require('../services/medicalOrderService');

// POST /api/medical-orders/laboratory
async function createLaboratoryOrder(req, res) {
  try {
    const user = req.user || {};
    const role = (user.role || '').toUpperCase();
    const body = req.body || {};

    // Determinar requestedBy: si el token es MEDICO usar su id, si no usar body.requestedBy
    const requestedBy = role === 'MEDICO' ? user.id : body.requestedBy || user.id;

    const { patientId, priority, clinicalNotes, requestedTests, requestedAt } = body;

    if (!patientId || isNaN(patientId)) {
      return res.status(400).json({ success: false, message: 'patientId es requerido y debe ser numérico' });
    }

    if (!requestedTests || !Array.isArray(requestedTests) || requestedTests.length === 0) {
      return res.status(400).json({ success: false, message: 'requestedTests es requerido y debe ser un array no vacío' });
    }

    const payload = {
      patientId: parseInt(patientId, 10),
      requestedBy,
      priority: priority || 'routine',
      clinicalNotes: clinicalNotes || null,
      requestedTests,
      requestedAt: requestedAt ? new Date(requestedAt) : new Date()
    };

    const created = await medicalOrderService.createLaboratoryOrder(payload, { userId: user.id });
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('[createLaboratoryOrder] error:', error);
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message || 'Error interno' });
  }
}

async function createRadiologyOrder(req, res) {
  try {
    const user = req.user || {};
    const role = (user.role || '').toUpperCase();
    const body = req.body || {};

    const requestedBy = role === 'MEDICO' ? user.id : body.requestedBy || user.id;

    const { patientId, priority, clinicalNotes, requestedTests, requestedAt } = body;

    if (!patientId || isNaN(patientId)) {
      return res.status(400).json({ success: false, message: 'patientId es requerido y debe ser numérico' });
    }

    if (!requestedTests || !Array.isArray(requestedTests) || requestedTests.length === 0) {
      return res.status(400).json({ success: false, message: 'requestedTests es requerido y debe ser un array no vacío' });
    }

    const payload = {
      patientId: parseInt(patientId, 10),
      requestedBy,
      priority: priority || 'routine',
      clinicalNotes: clinicalNotes || null,
      requestedTests,
      requestedAt: requestedAt ? new Date(requestedAt) : new Date()
    };

    const created = await medicalOrderService.createRadiologyOrder(payload, { userId: user.id });
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('[createRadiologyOrder] error:', error);
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message || 'Error interno' });
  }
}

module.exports = { createLaboratoryOrder, createRadiologyOrder };
