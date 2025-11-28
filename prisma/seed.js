const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const types = [
    {
      code: 'HEMOGRAMA',
      name: 'Hemograma',
      description: 'Hemograma completo: recuento de glóbulos rojos, blancos, plaquetas y hemoglobina.',
      tests: {
        items: [
          'Hemoglobina',
          'Hematocrito',
          'Recuento de glóbulos rojos (RBC)',
          'Recuento de glóbulos blancos (WBC)',
          'Recuento de plaquetas',
          'Índices eritrocitarios (MCV, MCH, MCHC)'
        ]
      }
    },
    {
      code: 'QUIMICA_SANGUINEA',
      name: 'Química sanguínea',
      description: 'Panel de química sanguínea: glucosa, electrolitos, función renal y hepática.',
      tests: {
        items: [
          'Glucosa',
          'Urea',
          'Creatinina',
          'Sodio',
          'Potasio',
          'Cloro',
          'Bilirrubina total',
          'AST (TGO)',
          'ALT (TGP)',
          'Fosfatasa alcalina',
          'Proteínas totales',
          'Albúmina'
        ]
      }
    },
    {
      code: 'ORINA',
      name: 'Orina',
      description: 'Análisis de orina: examen físico, químico y sedimento.',
      tests: {
        items: [
          'Color y aspecto',
          'Densidad',
          'pH',
          'Proteínas',
          'Glucosa',
          'Cuerpos cetónicos',
          'Sangre (hematuria)',
          'Nitritos',
          'Leucocitos',
          'Sedimento urinario'
        ]
      }
    }
  ];

  // Radiology exam templates
  const radiology = [
    {
      code: 'RAYOS_X',
      name: 'Rayos X',
      description: 'Estudios de radiografía simple: tórax, extremidades, columna, etc.',
      tests: {
        items: [
          'Tórax PA/AP',
          'Tórax lateral',
          'Columna cervical',
          'Columna torácica',
          'Columna lumbar',
          'Extremidades (segmento solicitado)'
        ]
      }
    },
    {
      code: 'TAC',
      name: 'TAC',
      description: 'Tomografía axial computarizada (CT): estudios con/ sin contraste según indicación.',
      tests: {
        items: [
          'TAC de cráneo',
          'TAC de tórax',
          'TAC de abdomen y pelvis',
          'TAC de columna',
          'TAC con contraste (segmento específico)'
        ]
      }
    },
    {
      code: 'RESONANCIA',
      name: 'Resonancia Magnética',
      description: 'Resonancia magnética (RM): estudios de alta resolución por indicación clínica.',
      tests: {
        items: [
          'RM de cráneo',
          'RM de columna',
          'RM de rodilla',
          'RM de cintura escapular',
          'RM de abdomen (segmento específico)'
        ]
      }
    },
    {
      code: 'ECOGRAFIA',
      name: 'Ecografía',
      description: 'Ecografía/ultrasonido: abdominal, pélvico, obstétrico, tiroides, Doppler, etc.',
      tests: {
        items: [
          'Ecografía abdominal',
          'Ecografía pélvica',
          'Ecografía obstétrica',
          'Ecografía tiroidea',
          'Doppler vascular'
        ]
      }
    }
  ];

  for (const r of radiology) {
    // Persistir en la tabla específica de radiología si existe
    try {
      await prisma.radiologyExamType.upsert({
        where: { code: r.code },
        update: {
          name: r.name,
          description: r.description,
          procedures: r.tests
        },
        create: {
          code: r.code,
          name: r.name,
          description: r.description,
          procedures: r.tests
        }
      });
    } catch (e) {
      // Si la tabla de radiología no existe, continuamos y aseguramos insertion en labExamType abajo
    }

    // También insertar/actualizar en `labExamType` para compatibilidad con búsquedas actuales
    try {
      await prisma.labExamType.upsert({
        where: { code: r.code },
        update: {
          name: r.name,
          description: r.description,
          tests: r.tests
        },
        create: {
          code: r.code,
          name: r.name,
          description: r.description,
          tests: r.tests
        }
      });
    } catch (e) {
      console.error('[seed] no se pudo upsert en labExamType para', r.code, e.message || e);
    }
  }

  for (const t of types) {
    await prisma.labExamType.upsert({
      where: { code: t.code },
      update: {
        name: t.name,
        description: t.description,
        tests: t.tests
      },
      create: {
        code: t.code,
        name: t.name,
        description: t.description,
        tests: t.tests
      }
    });
  }

  console.log('Seed: LabExamType created/updated');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
