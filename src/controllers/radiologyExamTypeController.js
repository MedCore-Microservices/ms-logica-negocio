const radiologyExamTypeService = require('../services/radiologyExamTypeService');

async function listRadiologyExamTypes(req, res) {
  try {
    const data = await radiologyExamTypeService.listAll();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('[listRadiologyExamTypes] error:', error);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
}

async function getRadiologyExamTypeByCode(req, res) {
  try {
    const { code } = req.params;
    if (!code) return res.status(400).json({ success: false, message: 'code es requerido' });

    const item = await radiologyExamTypeService.getByCode(code);
    if (!item) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });

    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error('[getRadiologyExamTypeByCode] error:', error);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
}

module.exports = { listRadiologyExamTypes, getRadiologyExamTypeByCode };
