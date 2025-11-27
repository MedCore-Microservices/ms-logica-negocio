const PrescriptionService = require('../services/PrescriptionService');
const service = new PrescriptionService();
const PDFDocument = require('pdfkit');
const fs = require('fs');

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

// POST /api/prescriptions/estimate-duration
async function estimateDuration(req, res) {
  try {
    let medications = req.body.medications || req.body.meds || req.body.medication || req.body.medicamentos;
    const persistFlag = (req.body.persist === true) || (String(req.query.persist || '').toLowerCase() === 'true');

    if (typeof medications === 'string') {
      try {
        medications = JSON.parse(medications);
      } catch (e) {
        medications = medications.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    if (!medications || (Array.isArray(medications) && medications.length === 0) || (!Array.isArray(medications))) {
      if (medications && !Array.isArray(medications)) medications = [medications];
    }

    if (!medications || !Array.isArray(medications) || medications.length === 0) {
      return res.status(400).json({ success: false, message: 'medications es requerido y debe ser un array no vacío' });
    }

    const results = medications.map((m) => {
      const medObj = (typeof m === 'string') ? { name: m } : Object.assign({}, m);
      const durationDays = service.inferDuration(medObj);
      medObj.durationDays = durationDays;
      return { medication: medObj, durationDays };
    });

    // Si no se pide persistencia, devolver solo la estimación
    if (!persistFlag) {
      return res.status(200).json({ success: true, data: results });
    }

    // Persistir la prescripción: validar permisos y datos requeridos
    const user = req.user || {};
    const role = (user.role || '').toUpperCase();

    if (!['MEDICO', 'ADMINISTRADOR'].includes(role)) {
      return res.status(403).json({ success: false, message: 'No autorizado para persistir prescripciones' });
    }

    // doctorId: si es MEDICO tomar del token; si ADMIN, esperar doctorId en body
    const doctorId = role === 'MEDICO' ? user.id : req.body.doctorId;
    const patientId = req.body.patientId;
    const title = req.body.title || `Prescripción - estimación`;
    const notes = req.body.notes;

    if (!doctorId) {
      return res.status(400).json({ success: false, message: 'doctorId es requerido para persistir (o usar token de MEDICO)' });
    }
    if (!patientId) {
      return res.status(400).json({ success: false, message: 'patientId es requerido para persistir' });
    }

    // Llamar al servicio de creación (este método normaliza y añade durationDays también)
    const created = await service.createPrescription({ doctorId, patientId, title, notes, medications: medications });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    const status = error.status || 400;
    return res.status(status).json({ success: false, message: error.message });
  }
}

module.exports = { create, getByPatient, checkAllergies, estimateDuration };

// GET /api/prescriptions/:id/pdf
async function generatePdf(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: 'id de prescripción requerido' });

    const presc = await service.getById(id);
    if (!presc) return res.status(404).json({ success: false, message: 'Prescripción no encontrada' });

    // Log básico para depuración: ver qué llega desde la DB
    console.log('[generatePdf] presc id=', presc.id, 'title=', presc.title, 'medsCount=', Array.isArray(presc.medications) ? presc.medications.length : 0);

    const role = (req.user?.role || '').toUpperCase();
    // paciente solo puede descargar su propia prescripción
    if (role === 'PACIENTE' && Number(req.user.id) !== Number(presc.patientId)) {
      return res.status(403).json({ success: false, message: 'No autorizado para descargar esta prescripción' });
    }


    // Preparar headers y stream. Usar textos por defecto si faltan campos.
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="prescription-${presc.id}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    // Acumulador de chunks para construir el buffer final
    const chunks = [];
    doc.on('data', (chunk) => {
      chunks.push(chunk);
      try { console.log('[generatePdf] doc chunk bytes=', chunk.length); } catch (e) { }
    });
    doc.on('end', () => { console.log('[generatePdf] doc end'); });
    doc.on('error', (err) => { console.error('[generatePdf] doc error', err); });

    res.on('close', () => { console.log('[generatePdf] response closed by client'); });
    res.on('finish', () => { console.log('[generatePdf] response finished'); });

    // Header
    doc.fontSize(20).text('Prescripción Médica', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`ID: ${presc.id}`);
    const createdAtText = presc.createdAt ? new Date(presc.createdAt).toLocaleString() : 'Sin fecha';
    doc.text(`Fecha: ${createdAtText}`);
    doc.moveDown();

    doc.text(`Doctor: ${presc.doctor?.fullname || presc.doctorId || 'N/D'}`);
    doc.text(`Paciente: ${presc.patient?.fullname || presc.patientId || 'N/D'}`);
    doc.moveDown();

    if (presc.title) {
      doc.fontSize(14).text(presc.title);
      doc.moveDown();
    }

    if (presc.notes) {
      doc.fontSize(12).text('Notas:');
      doc.text(presc.notes);
      doc.moveDown();
    }

    doc.fontSize(12).text('Medicamentos:');
    doc.moveDown(0.5);
    const meds = Array.isArray(presc.medications) ? presc.medications : [];
    if (meds.length === 0) {
      doc.text('No hay medicamentos registrados.');
    } else {
      meds.forEach((m, idx) => {
      const medObj = (typeof m === 'string') ? { name: m } : m || {};
      const name = medObj.name || JSON.stringify(medObj);
      const dose = medObj.dose || medObj.dosage || '';
      const duration = medObj.durationDays || medObj.duration || '';
      let line = `${idx + 1}. ${name}`;
      if (dose) line += ` - Dosificación: ${dose}`;
      if (duration) line += ` - Duración: ${duration} días`;
      doc.text(line);
      });
    }

    // Asegurar que cerramos el documento y manejamos errores del stream
    // Escribir también una copia local temporal y acumular en memoria
    const tmpPath = `/tmp/prescription-${presc.id}.pdf`;
    let fileStream;
    try {
      fileStream = fs.createWriteStream(tmpPath);
      fileStream.on('finish', () => {
        try {
          const st = fs.statSync(tmpPath);
          console.log('[generatePdf] temp file written:', tmpPath, 'size=', st.size);
        } catch (e) {
          console.error('[generatePdf] stat temp file error', e);
        }
      });
      fileStream.on('error', (err) => { console.error('[generatePdf] fileStream error', err); });
      doc.pipe(fileStream);
    } catch (e) {
      console.error('[generatePdf] could not create temp file', e);
    }

    // No hacemos pipe directo a res; acumulamos y enviaremos el buffer completo
    doc.end();

    // Cuando termine la generación, concatenamos y enviamos el buffer
    doc.once('end', () => {
      try {
        const pdfBuffer = Buffer.concat(chunks);
        console.log('[generatePdf] final buffer size=', pdfBuffer.length);
        // Asegurar que el fichero temporal fue escrito (fileStream finish listener se encargará)
        // Enviar al cliente con Content-Length
        if (!res.headersSent) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="prescription-${presc.id}.pdf"`);
          res.setHeader('Content-Length', pdfBuffer.length);
          res.statusCode = 200;
          res.end(pdfBuffer);
        } else {
          console.log('[generatePdf] headers already sent, cannot send buffer');
        }
      } catch (e) {
        console.error('[generatePdf] error sending buffer', e);
        try { if (!res.headersSent) res.status(500).json({ success: false, message: 'Error generando PDF' }); } catch(_){}
      }
    });
  } catch (error) {
    console.error('[generatePdf] error:', error);
    // Si ya se enviaron headers (el stream empezó), solo terminar el stream
    if (res.headersSent) {
      try { res.end(); } catch (e) { /* ignore */ }
      return;
    }
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
}

  module.exports = { create, getByPatient, checkAllergies, estimateDuration, generatePdf };
