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

    // ========== DISEÑO MEJORADO DE RECETA MÉDICA ==========
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 50;
    const contentWidth = pageWidth - (margin * 2);

    // ENCABEZADO INSTITUCIONAL
    doc.rect(margin, margin, contentWidth, 100).fillAndStroke('#0066cc', '#003d7a');
    
    doc.fillColor('#ffffff')
       .fontSize(24)
       .font('Helvetica-Bold')
       .text('MEDCORE', margin + 20, margin + 20, { align: 'left' });
    
    doc.fontSize(10)
       .font('Helvetica')
       .text('Sistema de Gestión Médica', margin + 20, margin + 50)
       .text('Av. Principal #123, Ciudad', margin + 20, margin + 65)
       .text('Tel: (123) 456-7890 | medcore@salud.com', margin + 20, margin + 80);

    // Número de receta en la esquina superior derecha
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text(`RECETA N° ${String(presc.id).padStart(8, '0')}`, pageWidth - margin - 150, margin + 30, { width: 140, align: 'right' });

    doc.fillColor('#000000');
    let yPos = margin + 120;

    // TÍTULO DEL DOCUMENTO
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .fillColor('#003d7a')
       .text('PRESCRIPCIÓN MÉDICA', margin, yPos, { width: contentWidth, align: 'center' });
    
    yPos += 40;

    // INFORMACIÓN DEL MÉDICO
    doc.roundedRect(margin, yPos, contentWidth / 2 - 10, 90, 5).fillAndStroke('#f0f8ff', '#0066cc');
    doc.fillColor('#000000')
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('MÉDICO TRATANTE', margin + 10, yPos + 10);
    
    doc.fontSize(10)
       .font('Helvetica')
       .text(`Dr(a). ${presc.doctor?.fullname || 'N/D'}`, margin + 10, yPos + 28)
       .text(`Registro Médico: ${presc.doctor?.licenseNumber || 'N/D'}`, margin + 10, yPos + 43)
       .text(`Especialidad: ${presc.doctor?.specialization?.name || 'Medicina General'}`, margin + 10, yPos + 58);

    // FECHA Y HORA
    const createdAtText = presc.createdAt ? new Date(presc.createdAt).toLocaleDateString('es-ES', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : 'Sin fecha';
    
    doc.roundedRect(pageWidth / 2 + 10, yPos, contentWidth / 2 - 10, 90, 5).fillAndStroke('#fff4e6', '#ff9800');
    doc.fillColor('#000000')
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('FECHA DE EMISIÓN', pageWidth / 2 + 20, yPos + 10);
    
    doc.fontSize(10)
       .font('Helvetica')
       .text(createdAtText, pageWidth / 2 + 20, yPos + 35, { width: (contentWidth / 2) - 30 });

    yPos += 110;

    // INFORMACIÓN DEL PACIENTE
    doc.roundedRect(margin, yPos, contentWidth, 110, 5).fillAndStroke('#f0fff0', '#00cc66');
    doc.fillColor('#000000')
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('DATOS DEL PACIENTE', margin + 10, yPos + 10);
    
    const patient = presc.patient || {};
    doc.fontSize(10)
       .font('Helvetica')
       .text(`Nombre: ${patient.fullname || 'N/D'}`, margin + 10, yPos + 30)
       .text(`Documento: ${patient.identificationNumber || 'N/D'}`, margin + 10, yPos + 45)
       .text(`Edad: ${patient.age || 'N/D'} años`, margin + 10, yPos + 60)
       .text(`Género: ${patient.gender || 'N/D'}`, margin + 250, yPos + 60)
       .text(`Tipo de Sangre: ${patient.bloodType || 'N/D'}`, margin + 400, yPos + 60);

    if (patient.allergies) {
      doc.fillColor('#cc0000')
         .font('Helvetica-Bold')
         .text(`⚠ ALERGIAS: ${patient.allergies}`, margin + 10, yPos + 80);
      doc.fillColor('#000000');
    }

    yPos += 130;

    // DIAGNÓSTICO
    if (presc.title) {
      doc.roundedRect(margin, yPos, contentWidth, 50, 5).fillAndStroke('#fffacd', '#ffd700');
      doc.fillColor('#000000')
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('DIAGNÓSTICO / MOTIVO', margin + 10, yPos + 10);
      
      doc.fontSize(10)
         .font('Helvetica')
         .text(presc.title, margin + 10, yPos + 28, { width: contentWidth - 20 });
      
      yPos += 70;
    }

    // INDICACIONES GENERALES
    if (presc.notes) {
      doc.roundedRect(margin, yPos, contentWidth, 60, 5).fillAndStroke('#f5f5f5', '#999999');
      doc.fillColor('#000000')
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('INDICACIONES GENERALES', margin + 10, yPos + 10);
      
      doc.fontSize(9)
         .font('Helvetica')
         .text(presc.notes, margin + 10, yPos + 28, { width: contentWidth - 20, lineGap: 2 });
      
      yPos += 80;
    }

    // MEDICAMENTOS PRESCRITOS
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('#003d7a')
       .text('MEDICAMENTOS PRESCRITOS', margin, yPos);
    
    yPos += 25;

    const meds = Array.isArray(presc.medications) ? presc.medications : [];
    if (meds.length === 0) {
      doc.fontSize(10).font('Helvetica').fillColor('#666666')
         .text('No hay medicamentos registrados.', margin + 10, yPos);
      yPos += 30;
    } else {
      meds.forEach((m, idx) => {
        const medObj = (typeof m === 'string') ? { name: m } : m || {};
        const name = medObj.name || JSON.stringify(medObj);
        const dose = medObj.dose || medObj.dosage || '';
        const frequency = medObj.frequency || '';
        const duration = medObj.durationDays || medObj.duration || '';
        const instructions = medObj.instructions || '';

        // Verificar si hay espacio suficiente, si no, nueva página
        if (yPos > pageHeight - 250) {
          doc.addPage();
          yPos = margin + 50;
        }

        // Caja del medicamento
        const boxHeight = instructions ? 95 : 75;
        doc.roundedRect(margin, yPos, contentWidth, boxHeight, 3).fillAndStroke('#ffffff', '#0066cc');
        
        // Número del medicamento
        doc.roundedRect(margin + 5, yPos + 5, 25, 25, 3).fillAndStroke('#0066cc', '#003d7a');
        doc.fillColor('#ffffff')
           .fontSize(14)
           .font('Helvetica-Bold')
           .text(`${idx + 1}`, margin + 12, yPos + 11);

        // Nombre del medicamento
        doc.fillColor('#000000')
           .fontSize(11)
           .font('Helvetica-Bold')
           .text(name, margin + 40, yPos + 8, { width: contentWidth - 50 });

        // Dosificación
        if (dose) {
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor('#333333')
             .text(`Dosis: ${dose}`, margin + 40, yPos + 28);
        }

        // Frecuencia
        if (frequency) {
          doc.text(`Frecuencia: ${frequency}`, margin + 40, yPos + 43);
        }

        // Duración
        if (duration) {
          doc.text(`Duración: ${duration} días`, margin + 40, yPos + 58);
        }

        // Instrucciones especiales
        if (instructions) {
          doc.roundedRect(margin + 40, yPos + 70, contentWidth - 50, 20, 2).fillAndStroke('#fffacd', '#ffd700');
          doc.fillColor('#000000')
             .fontSize(8)
             .font('Helvetica-Oblique')
             .text(`→ ${instructions}`, margin + 45, yPos + 75, { width: contentWidth - 60 });
        }

        yPos += boxHeight + 10;
      });
    }

    // Verificar espacio para footer
    if (yPos > pageHeight - 200) {
      doc.addPage();
      yPos = margin + 50;
    }

    yPos += 20;

    // RECOMENDACIONES GENERALES
    doc.fontSize(9)
       .font('Helvetica-Oblique')
       .fillColor('#666666')
       .text('• Siga estrictamente las indicaciones médicas', margin, yPos)
       .text('• No suspenda el tratamiento sin consultar a su médico', margin, yPos + 15)
       .text('• Consulte inmediatamente si presenta efectos adversos', margin, yPos + 30)
       .text('• Esta receta tiene validez de 30 días desde su emisión', margin, yPos + 45);

    yPos += 75;

    // FIRMA DEL MÉDICO
    doc.moveTo(margin + 300, yPos).lineTo(pageWidth - margin - 50, yPos).stroke('#000000');
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('#000000')
       .text('Firma y Sello del Médico', margin + 300, yPos + 10, { width: pageWidth - margin - 350, align: 'center' });
    
    doc.fontSize(9)
       .font('Helvetica')
       .text(`Dr(a). ${presc.doctor?.fullname || 'N/D'}`, margin + 300, yPos + 28, { width: pageWidth - margin - 350, align: 'center' })
       .text(`Reg. Médico: ${presc.doctor?.licenseNumber || 'N/D'}`, margin + 300, yPos + 43, { width: pageWidth - margin - 350, align: 'center' });

    // PIE DE PÁGINA
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#999999')
       .text(`Documento generado electrónicamente por MedCore - ${new Date().toLocaleString('es-ES')}`, 
             margin, pageHeight - margin - 20, 
             { width: contentWidth, align: 'center' });
    
    doc.text(`Prescripción ID: ${presc.id} | Válida hasta: ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('es-ES')}`,
             margin, pageHeight - margin - 10,
             { width: contentWidth, align: 'center' });

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
