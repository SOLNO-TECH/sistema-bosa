/**
 * Expansión de frases habladas a comandos canónicos — sin IA, solo reglas.
 */
const { preprocessTranscript } = require('./voiceTranscriptNormalize');

const IMPLICIT_RULES = [
  [/\bnecesito\s+(?:que\s+)?(?:revisen|revisar|arreglen|arreglar|vean|ver)\s+(.+)/i, 'crear ticket $1'],
  [/\b(?:hay|tengo)\s+(?:una\s+)?falla\s+(?:en|con|de)\s+/i, 'reportar problema con '],
  [/\b(?:hay|tengo)\s+(?:un\s+)?(?:problema|error)\s+(?:en|con|de)\s+/i, 'reportar problema con '],
  [/\b(.{4,60})\s+(?:no funciona|no enciende|no prende|esta rota|está rota|esta dañada|está dañada|se descompuso)\b/i, 'crear ticket $1'],
  [/\bpublica(?:r|me)?\s+(?:un\s+)?(?:aviso|comunicado)\s+(?:de|sobre|acerca de)\s+/i, 'publicar aviso '],
  [/\bencarga(?:r|le|a)\s+(?:a|la tarea a|el ticket a)\s+/i, 'asignar a '],
  [/\bjuntame\s+con\s+/i, 'crear reunion invitar '],
  [/\breun(?:ion|ión)\s+con\s+(?:el\s+)?departamento\s+/i, 'reunion departamento '],
  [/\bagendar\s+(?!reunion|junta|cita)(.+?\s+(?:manana|mañana|hoy|pasado|lunes|martes|miercoles|jueves|viernes|sabado|domingo|a\s+las|\d{1,2}))/i, 'agendar reunion $1'],
  [/\bprogramar\s+(?!reunion|junta|cita)(.+?\s+(?:manana|mañana|hoy|a\s+las|\d{1,2}))/i, 'programar reunion $1'],
  [/\b(?:que|qué)\s+tickets\s+(?:tengo|hay)\s+(?:abiertos|pendientes)/i, 'mis tickets pendientes'],
  [/\b(?:que|qué)\s+reuniones\s+(?:tengo|hay)/i, 'mis reuniones'],
  [/\b(?:que|qué)\s+tareas\s+(?:tengo|hay)\s+pendientes/i, 'mis tareas pendientes'],
  [/\bcuando\s+es\s+(?:mi\s+)?(?:proxima|próxima|siguiente)\s+reunion/i, 'próxima reunión'],
  [/\b(?:cierra|cerrar)\s+(?:el\s+)?ticket\s*#?\s*(\d+)/i, 'ticket $1 cerrado'],
  [/\b(?:termina|terminar|completa|completar)\s+(?:la\s+)?tarea\s*#?\s*(\d+)/i, 'tarea $1 completada'],
  [/\b(?:pon|poner)\s+(?:el\s+)?ticket\s*#?\s*(\d+)\s+en\s+progreso/i, 'ticket $1 en progreso'],
];

function expandImplicitCommands(text) {
  let s = String(text || '').trim();
  if (!s) return s;

  for (const [re, rep] of IMPLICIT_RULES) {
    if (re.test(s)) {
      s = s.replace(re, rep);
      break;
    }
  }
  return s.replace(/\s+/g, ' ').trim();
}

function fullLocalNormalize(text) {
  return expandImplicitCommands(preprocessTranscript(text));
}

module.exports = {
  expandImplicitCommands,
  fullLocalNormalize,
};
