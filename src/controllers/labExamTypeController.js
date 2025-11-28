const labExamTypeService = require('../services/labExamTypeService');

async function listLabExamTypes(req, res) {
  try {
    const data = await labExamTypeService.listAll();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('[listLabExamTypes] error:', error);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
}

async function getLabExamTypeByCode(req, res) {
  try {
    const { code } = req.params;
    if (!code) return res.status(400).json({ success: false, message: 'code es requerido' });

    const item = await labExamTypeService.getByCode(code);
    if (!item) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });

    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error('[getLabExamTypeByCode] error:', error);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
}

module.exports = { listLabExamTypes, getLabExamTypeByCode };
