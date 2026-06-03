/**
 * Regresión de parseo de voz — ejecutar: node scripts/voice-parse-regression.js
 */
const { parseVoiceCommand } = require('../src/services/voiceCommandParserService');

const users = [
  { id: 1, name: 'Maria', apellido: 'Lopez', departamento: 'Operaciones', puesto: 'Gerente', role: 'manager', is_active: 1 },
  { id: 2, name: 'Juan', apellido: 'Perez', departamento: 'Sistemas', puesto: 'Analista', role: 'manager', is_active: 1 },
];

const actor = users[0];
const ctx = { users, actor, activeModule: 'calendar' };

const CASES = [
  {
    utterance: 'crea ticket impresora rota prioridad alta',
    expect: { intent: 'create_ticket', canExecute: true, titleIncludes: 'impresora' },
  },
  {
    utterance: 'crea tarea revisar planos asignar a Maria Lopez',
    expect: { intent: 'create_task', canExecute: true, hasAssignee: true },
  },
  {
    utterance: 'asignar ticket 5 a Juan Perez',
    expect: { intent: 'assign_ticket', canExecute: true, ticketId: 5 },
  },
  {
    utterance: 'agenda reunion revision semanal de obra manana a las 10 virtual',
    expect: { intent: 'create_meeting', canExecute: true, titleIncludes: 'revision semanal' },
  },
  {
    utterance: 'hay reuniones hoy',
    expect: { intent: 'query_meetings', canExecute: true },
  },
  {
    utterance: 'crear reunion',
    expect: { intent: 'create_meeting', canExecute: false, needsClarification: true },
  },
  {
    utterance: 'abrir calendario',
    expect: { intent: 'navigate', module: 'calendar' },
  },
  {
    utterance: 'impresora no funciona',
    expect: { intent: 'create_ticket', canExecute: true, titleIncludes: 'impresora' },
  },
  {
    utterance: 'que tickets tengo abiertos',
    expect: { intent: 'query_tickets', canExecute: true },
  },
  {
    utterance: 'juntame con operaciones manana a las 10',
    expect: { intent: 'create_meeting', canExecute: true },
  },
  {
    utterance: 'asignar ticket 3 a Maria Lopes',
    expect: { intent: 'assign_ticket', canExecute: true, ticketId: 3, hasAssignee: true },
  },
  {
    utterance: 'cerrar ticket 7',
    expect: { intent: 'update_ticket_status', canExecute: true, ticketId: 7 },
  },
  {
    utterance: 'publicar aviso corte de agua el viernes',
    expect: { intent: 'create_aviso', canExecute: true },
  },
];

function checkCase(test) {
  const r = parseVoiceCommand(test.utterance, ctx);
  const e = test.expect;
  const errors = [];

  if (e.intent && r.intent !== e.intent) errors.push(`intent: got ${r.intent}, want ${e.intent}`);
  if (e.canExecute != null && Boolean(r.canExecute) !== e.canExecute) {
    errors.push(`canExecute: got ${r.canExecute}, want ${e.canExecute}`);
  }
  if (e.needsClarification != null && Boolean(r.needsClarification) !== e.needsClarification) {
    errors.push(`needsClarification: got ${r.needsClarification}, want ${e.needsClarification}`);
  }
  if (e.titleIncludes && !String(r.params?.title || '').toLowerCase().includes(e.titleIncludes)) {
    errors.push(`title missing "${e.titleIncludes}" in "${r.params?.title}"`);
  }
  if (e.hasAssignee && !r.params?.assigned_to) errors.push('missing assigned_to');
  if (e.ticketId && Number(r.params?.ticket_id) !== e.ticketId) {
    errors.push(`ticket_id: got ${r.params?.ticket_id}, want ${e.ticketId}`);
  }
  if (e.taskId && Number(r.params?.task_id) !== e.taskId) {
    errors.push(`task_id: got ${r.params?.task_id}, want ${e.taskId}`);
  }
  if (e.module && r.params?.module !== e.module) errors.push(`module: got ${r.params?.module}, want ${e.module}`);

  return { ok: !errors.length, errors, r };
}

let passed = 0;
let failed = 0;

console.log('BOSA voice parse regression\n');

for (const test of CASES) {
  const { ok, errors, r } = checkCase(test);
  if (ok) {
    passed += 1;
    console.log(`✓ ${test.utterance.slice(0, 60)}`);
  } else {
    failed += 1;
    console.log(`✗ ${test.utterance.slice(0, 60)}`);
    errors.forEach((e) => console.log(`  - ${e}`));
    console.log(`  → intent=${r.intent} canExecute=${r.canExecute} quality=${r.parseQuality}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed, ${CASES.length} total`);
process.exit(failed ? 1 : 0);
