// ===============================================
// Tests de concurrencia, conflictos y performance
// ===============================================
//
//¿Qué validamos aquí?
// 1) Concurrency testing: cuando DOS usuarios piden la MISMA cita al MISMO tiempo,
//    sólo una debe ser creada y la otra debe fallar (mensaje de solapamiento).
// 2) Conflict resolution testing: si ya existe una cita en ese horario, la segunda
//    creación debe ser rechazada (doble reserva en el mismo horario).
// 3) Performance testing: podemos crear 100 citas válidas rápidamente (sin solaparse)
//    en menos de 60 segundos.
//
// ¿Por qué un MOCK y no la BD real?
// Usar la base de datos real para forzar condiciones de carrera es más lento y menos determinista. Aquí construimos un
// mock de Prisma que simula:
//   - Transacciones ($transaction) como una simple llamada síncrona al callback.
//   - Restricción única compuesta (doctorId,date) lanzando un error con código Prisma 'P2002'.
// Esto nos permite reproducir rápidamente el comportamiento esperado (rechazo por duplicado) en memoria.
//
// ¿Cómo simulamos la restricción única?
// Mantenemos un Set (createdKeys) donde guardamos la clave "doctorId|ISODate" cada vez que se crea una cita.
// Si alguien intenta crear otra cita con la misma combinación, lanzamos error P2002 igual que haría Prisma/Postgres.
//
// ¿Diferencia entre test de CONFLICTO y test de CONCURRENCIA?
//   - CONFLICTO: Secuencial. Creamos una cita y luego intentamos otra EXACTAMENTE igual; debe fallar.
//   - CONCURRENCIA: Paralelo (Promise.allSettled). Dos promesas lanzadas al mismo tiempo para el mismo slot; sólo una
//                   debe lograr crear la cita, la otra recibe el error simulado de solapamiento / P2002.
//
// ¿Por qué usamos Promise.allSettled en concurrencia?
// Permite capturar en un arreglo las respuestas de ambas creaciones simultáneas sin abortar todo si una falla. Luego
// contamos fulfilled vs rejected para verificar el comportamiento.
//
// Performance: Creamos 100 citas distribuidas en varios días para no chocar con la restricción y medimos el tiempo.
// Este test no busca estrés extremo, sólo asegurar que la lógica interna y el mock no introducen demoras exageradas.
// ===============================================


// Mock Prisma con almacenamiento en memoria para simular restricción única [doctorId,date]
const createdKeys = new Set();
const mockPrisma = {
  // Simulación de $transaction: en una BD real se abriría una transacción; aquí sólo llamamos el callback directamente.
  $transaction: async (cb) => cb(mockPrisma),
  appointment: {
    findMany: jest.fn(async ({ where }) => {
      // Recupera todas las citas existentes del mismo doctor en el rango de un día.
      // Se basa en las llaves guardadas, reconstruyendo objetos mínimos {id, date}.
      const results = [];
      for (const key of createdKeys) {
        const [dIdStr, iso] = key.split('|');
        const dId = parseInt(dIdStr, 10);
        const date = new Date(iso);
        if (where.doctorId === dId) {
          const dayStart = new Date(where.date.gte);
          const dayEnd = new Date(where.date.lte);
          if (date >= dayStart && date <= dayEnd) {
            results.push({ id: results.length + 1, date });
          }
        }
      }
      return results;
    }),
    create: jest.fn(async ({ data }) => {
      // Simulación directa de la validación única: si ya existe la clave, lanzamos error P2002.
      const key = `${data.doctorId}|${data.date.toISOString()}`;
      if (createdKeys.has(key)) {
        const err = new Error('Unique constraint failed on the fields: (doctorId,date)');
        err.code = 'P2002';
        throw err; // Simular restricción única
      }
      createdKeys.add(key);
      // Retornamos objeto representando la cita creada (id incremental = tamaño del Set).
      return { id: createdKeys.size, ...data };
    }),
    findUnique: jest.fn(),
    update: jest.fn(async ({ where, data }) => ({ id: where.id, ...data })), // No se usa en estos tests pero se expone.
  },
};

jest.doMock('../../config/database', () => mockPrisma);
// Evitar notificaciones reales
jest.doMock('../../services/NotificationService', () => ({
  autoNotifyAppointment: jest.fn().mockResolvedValue({ success: true })
}));

const AppointmentService = require('../../services/AppointmentService');

describe('AppointmentService - Concurrency & Conflicts', () => {
  let service;

  beforeEach(() => {
    service = new AppointmentService();
    createdKeys.clear();
    jest.clearAllMocks();
  });

  test('Conflict resolution: no permite doble cita en el mismo horario (mismo doctor, misma fecha)', async () => {
    // PASO 1: Creamos una cita en 10:00.
    const start = new Date();
    start.setHours(10, 0, 0, 0);
    const first = await service.createAppointment({ userId: 1, doctorId: 7, date: start.toISOString(), reason: 'Control' });
    expect(first.id).toBe(1);
    // PASO 2: Intentamos segunda cita EXACTAMENTE igual -> debe lanzar error de solapamiento o disponibilidad.
    await expect(
      service.createAppointment({ userId: 2, doctorId: 7, date: start.toISOString(), reason: 'Otro' })
    ).rejects.toThrow(/no está disponible|solapamiento/i);
  });

  test('Concurrency: dos creaciones simultáneas para mismo doctor/fecha -> sólo una debe pasar', async () => {
    // Simulamos dos usuarios enviando la creación al "mismo tiempo" (sin await entre ellas)
    const start = new Date();
    start.setHours(11, 0, 0, 0);
    const p1 = service.createAppointment({ userId: 10, doctorId: 9, date: start.toISOString(), reason: 'A' });
    const p2 = service.createAppointment({ userId: 11, doctorId: 9, date: start.toISOString(), reason: 'B' });
    // Promise.allSettled nos deja ver el resultado de ambas sin abortar en la primera que falla.
    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    // Verificamos: exactamente una exitosa y una rechazada.
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(rejected[0].reason.message).toMatch(/no está disponible|solapamiento/i);
  });

  test('Performance: crear 100 citas en < 60s distribuidas en múltiples días sin solapamientos', async () => {
    // Cálculo de tiempo inicial para medir ejecución completa.
    const t0 = Date.now();
    const baseDay = new Date();
    baseDay.setHours(8, 0, 0, 0); // primer día 08:00
    const slotsPerDay = 20; // 10 horas laborales (08-18) / slot de 30 min = 20 slots
    const promises = [];
    for (let i = 0; i < 100; i++) {
      const dayOffset = Math.floor(i / slotsPerDay);
      const indexInDay = i % slotsPerDay; // 0..19
      const slot = new Date(baseDay);
      slot.setDate(baseDay.getDate() + dayOffset); // distribuir días
      slot.setHours(8, 0, 0, 0);
      slot.setMinutes(slot.getMinutes() + indexInDay * 30);
      promises.push(
        service.createAppointment({ userId: 1000 + i, doctorId: 15, date: slot.toISOString(), reason: `Batch ${i}` })
      );
    }
    // Ejecutamos el batch en paralelo (sin solapamientos por diseño de slots).
    const results = await Promise.all(promises);
    expect(results).toHaveLength(100);
    const t1 = Date.now();
    const elapsed = (t1 - t0) / 1000;
    // Aseguramos que la suite completa no demoró más de 60 segundos.
    expect(elapsed).toBeLessThan(60);
  });
});
