const prisma = require('../config/database');

class PrescriptionService {
  // Infer duration in days for a medication object or string
  inferDuration(med) {
    if (!med) return 7;
    // Respect explicit duration fields if provided
    if (med.durationDays || med.duration) return Number(med.durationDays || med.duration);

    const raw = (med.name || med.type || med).toString().toLowerCase();

    // Common heuristic rules by keyword matching
    if (/amoxi|amoxicillin|cef|ceph|penicill|azithro|doxy|metronidazole|cipro|levo|erythro/.test(raw)) return 7;
    if (/antifungal|fluconazol|itraconazol|miconazol|ketoconazol/.test(raw)) return 14;
    if (/antiviral|acyclovir|oseltamivir|valaciclovir/.test(raw)) return 5;
    if (/analgesic|ibuprofen|paracetamol|acetaminophen|naproxen|diclofenac/.test(raw)) return 5;
    if (/inhal|nebul|inhaler|bronchodilat|salbutamol|salmeterol|budesonide/.test(raw)) return 30;
    if (/insulin|metformin|glipizid|sitagliptin|antidiabetic|antidiab/.test(raw)) return 30;
    if (/antihypertensive|lisinopril|enalapril|amlodipine|losartan|valsartan/.test(raw)) return 30;
    if (/topical|cream|ointment|unguent|gel|locion|spray/.test(raw)) return 7;

    // Type-based hints
    if (med.type) {
      const t = med.type.toString().toLowerCase();
      if (t === 'chronic') return 30;
      if (t === 'acute') return 7;
    }

    // Default fallback
    return 7;
  }
  async createPrescription({ doctorId, patientId, title, notes, medications }) {
    if (!doctorId || !patientId || !title || !medications) {
      const err = new Error('doctorId, patientId, title y medications son obligatorios');
      err.status = 400;
      throw err;
    }

    // Aceptar medications como array o JSON string
    let meds = medications;
    if (typeof meds === 'string') {
      try {
        meds = JSON.parse(medications);
      } catch (e) {
        const err = new Error('medications debe ser un JSON válido o un array');
        err.status = 400;
        throw err;
      }
    }

    if (!Array.isArray(meds) || meds.length === 0) {
      const err = new Error('medications debe ser un array no vacío');
      err.status = 400;
      throw err;
    }

    // Opcional: validar existencia de doctor y paciente
    const [doctor, patient] = await Promise.all([
      prisma.user.findUnique({ where: { id: Number(doctorId) } }),
      prisma.user.findUnique({ where: { id: Number(patientId) } })
    ]);

    if (!doctor) {
      const err = new Error('Médico no encontrado');
      err.status = 404;
      throw err;
    }

    if (!patient) {
      const err = new Error('Paciente no encontrado');
      err.status = 404;
      throw err;
    }

    // Calcular duración de tratamiento por medicamento y normalizar estructura
    const normalizedMeds = meds.map((m) => {
      // Si viene como string, convertir a objeto simple
      const medObj = (typeof m === 'string') ? { name: m } : Object.assign({}, m);
      medObj.durationDays = this.inferDuration(medObj);
      return medObj;
    });

    // Crear prescripción
    const created = await prisma.prescription.create({
      data: {
        doctorId: Number(doctorId),
        patientId: Number(patientId),
        title,
        notes: notes || null,
        medications: normalizedMeds
      }
    });

    return created;
  }

  async getByPatient(patientId, options = {}) {
    const { limit = 50, offset = 0 } = options;
    const items = await prisma.prescription.findMany({
      where: { patientId: Number(patientId) },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
      include: { doctor: { select: { id: true, fullname: true } } }
    });

    // Asegurar que cada medicamento tenga durationDays (no persiste en DB)
    const normalized = items.map((presc) => {
      const meds = Array.isArray(presc.medications) ? presc.medications : [];
      const newMeds = meds.map((m) => {
        const medObj = (typeof m === 'string') ? { name: m } : Object.assign({}, m);
        if (!medObj.durationDays) medObj.durationDays = this.inferDuration(medObj);
        return medObj;
      });
      return Object.assign({}, presc, { medications: newMeds });
    });

    return normalized;
  }

  async getById(id) {
    if (!id) return null;
    const presc = await prisma.prescription.findUnique({
      where: { id: Number(id) },
      include: {
        doctor: { select: { id: true, fullname: true } },
        patient: { select: { id: true, fullname: true } }
      }
    });
    if (!presc) return null;
    const meds = Array.isArray(presc.medications) ? presc.medications.map((m) => {
      const medObj = (typeof m === 'string') ? { name: m } : Object.assign({}, m);
      if (!medObj.durationDays) medObj.durationDays = this.inferDuration(medObj);
      return medObj;
    }) : [];
    return Object.assign({}, presc, { medications: meds });
  }

  // Verificar alergias del paciente contra una lista de medicamentos
  // medications: array de objetos con al menos { name }
  async checkAllergies(patientId, medications) {
    if (!patientId) {
      const err = new Error('patientId es requerido');
      err.status = 400;
      throw err;
    }
    if (!medications || !Array.isArray(medications)) {
      const err = new Error('medications debe ser un array');
      err.status = 400;
      throw err;
    }

    // Obtener alergias del usuario (campo `allergies`) y de su medical record si existe
    const user = await prisma.user.findUnique({ where: { id: Number(patientId) }, select: { id: true, fullname: true, allergies: true } });
    if (!user) {
      const err = new Error('Paciente no encontrado');
      err.status = 404;
      throw err;
    }

    // Intentar leer alergias desde medical records (si contienen campo `allergies` JSON/string)
    const medRecord = await prisma.medicalRecord.findFirst({ where: { userId: Number(patientId) }, select: { allergies: true } });

    const allergySources = [];
    if (user.allergies) allergySources.push(user.allergies);
    if (medRecord && medRecord.allergies) allergySources.push(medRecord.allergies);

    // Normalizar lista de alergias: pueden venir como string separado por comas o como JSON
    let allergies = [];
    for (const src of allergySources) {
      if (!src) continue;
      if (typeof src === 'string') {
        try {
          const parsed = JSON.parse(src);
          if (Array.isArray(parsed)) {
            allergies = allergies.concat(parsed.map(s => String(s)));
            continue;
          }
        } catch (e) {
          // no JSON, tratar como CSV
        }
        // CSV split by commas or semicolons
        const parts = src.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
        allergies = allergies.concat(parts);
      } else if (Array.isArray(src)) {
        allergies = allergies.concat(src.map(s => String(s)));
      }
    }

    // Normalizar y deduplicar
    const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
    const allergySet = new Set(allergies.map(a => normalize(a)).filter(Boolean));

    // Para cada medicamento, comprobar si su nombre contiene alguna alergia
    const results = medications.map((med) => {
      const name = normalize(med.name || med);
      const matches = [];
      for (const a of allergySet) {
        if (!a) continue;
        // coincidencia simple: token aparece en el nombre
        if (name.includes(a)) matches.push(a);
      }
      return {
        medication: med,
        allergic: matches.length > 0,
        matches
      };
    });

    return { patient: { id: user.id, fullname: user.fullname }, results };
  }
}

module.exports = PrescriptionService;
