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

// GET /api/medical-orders/:id
async function getOrder(req, res) {
  try {
    const user = req.user || {};
    const role = (user.role || '').toUpperCase();
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'id de orden requerido' });
    }

    const result = await medicalOrderService.getOrderById(id);

    // Permisos: PACIENTE solo puede ver sus propias órdenes
    if (role === 'PACIENTE' && Number(user.id) !== Number(result.patientId)) {
      return res.status(403).json({ success: false, message: 'No autorizado para ver esta orden' });
    }

    return res.status(200).json({ success: true, data: result.order });
  } catch (error) {
    console.error('[getOrder] error:', error);
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message || 'Error interno' });
  }
}

// GET /api/medical-orders/patient/:patientId
async function getOrdersByPatient(req, res) {
  try {
    const user = req.user || {};
    const role = (user.role || '').toUpperCase();
    const { patientId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;

    if (!patientId || isNaN(patientId)) {
      return res.status(400).json({ success: false, message: 'patientId es requerido y debe ser numérico' });
    }

    // Permisos: si es PACIENTE solo puede consultar su propio historial
    if (role === 'PACIENTE' && Number(user.id) !== Number(patientId)) {
      return res.status(403).json({ success: false, message: 'No autorizado para consultar otro paciente' });
    }

    const data = await medicalOrderService.getOrdersByPatient(patientId, { limit, offset });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('[getOrdersByPatient] error:', error);
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message || 'Error interno' });
  }
}

// GET /api/medical-orders
async function getAllOrders(req, res) {
  try {
    const user = req.user || {};
    const role = (user.role || '').toUpperCase();
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    const type = req.query.type; // 'laboratory' o 'radiology', opcional

    // Si es MEDICO, solo ver sus propias órdenes. ADMINISTRADOR y ENFERMERA ven todas.
    const requestedBy = role === 'MEDICO' ? user.id : null;

    const data = await medicalOrderService.getAllOrders({ limit, offset, type, requestedBy });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('[getAllOrders] error:', error);
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message || 'Error interno' });
  }
}

module.exports = { createLaboratoryOrder, createRadiologyOrder, getOrder, getOrdersByPatient, getAllOrders };
