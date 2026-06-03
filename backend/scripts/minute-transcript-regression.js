/**
 * Regresión de minuta desde transcripción — ejecutar: node scripts/minute-transcript-regression.js
 */
const { buildMinuteDraftFromTranscript } = require('../src/services/minuteFromTranscriptService');
const { structureTranscript } = require('../src/services/transcriptSpeakerService');

const usersById = new Map([
  [1, { id: 1, name: 'Ana', apellido: 'García', puesto: 'Gerente', departamento: 'Operaciones' }],
  [2, { id: 2, name: 'Juan', apellido: 'Pérez', puesto: 'Analista', departamento: 'Sistemas' }],
]);

const meeting = {
  id: 42,
  title: 'Revisión semanal de obra',
  location_type: 'sala_juntas',
  start_time: '2026-05-28T10:00:00',
  end_time: '2026-05-28T11:00:00',
  attendees: [1, 2],
};

const SAMPLE = `
Ana García: Buen día a todos. Empezamos la revisión semanal de obra.
Juan Pérez: Se presentó el avance del edificio B al 75 por ciento.
Ana García: Se acuerda continuar con la fase de acabados la próxima semana.
Juan Pérez: Pendiente enviar el reporte fotográfico para el viernes.
Ana García: Juan debe entregar el reporte antes del viernes a las 5.
Se decidió convocar otra reunión el lunes para revisar proveedores.
`.trim();

function runCase(name, transcript, locationType = 'sala_juntas') {
  const attendeeUsers = meeting.attendees.map((id) => usersById.get(id)).filter(Boolean);
  const structured = structureTranscript(transcript, attendeeUsers, locationType);
  const draft = buildMinuteDraftFromTranscript(meeting, usersById, transcript, structured);
  const errors = [];

  if (!draft.topics || draft.topics.length !== 3) errors.push(`topics: expected 3, got ${draft.topics?.length}`);
  if (!draft.minute_brief?.executive_summary) errors.push('missing executive_summary');
  if (!draft.minute_brief?.agreements?.length) errors.push('expected agreements');
  if (!draft.minute_brief?.action_items?.length) errors.push('expected action_items');
  if (!draft.minute_brief?.stats?.word_count) errors.push('missing word_count');
  if (!draft.topics[0]?.descripcion?.includes('Puntos tratados')) errors.push('topic 1 missing structured header');
  if (!draft.topics[1]?.titulo?.toLowerCase().includes('acuerdo')) errors.push('topic 2 should be acuerdos');

  return { ok: !errors.length, errors, draft };
}

const cases = [
  { name: 'sala con etiquetas de hablante', fn: () => runCase('sala', SAMPLE) },
  {
    name: 'virtual sin etiquetas',
    fn: () =>
      runCase(
        'virtual',
        'Se discutió el presupuesto del trimestre. Se acuerda reducir gastos en viajes. Pendiente revisar contratos antes del 15 de junio.',
        'virtual',
      ),
  },
];

let passed = 0;
let failed = 0;

console.log('BOSA minute transcript regression\n');

for (const c of cases) {
  const { ok, errors } = c.fn();
  if (ok) {
    passed += 1;
    console.log(`✓ ${c.name}`);
  } else {
    failed += 1;
    console.log(`✗ ${c.name}`);
    errors.forEach((e) => console.log(`  - ${e}`));
  }
}

console.log(`\n${passed} passed, ${failed} failed, ${cases.length} total`);
process.exit(failed ? 1 : 0);
