/**
 * Reparación agresiva de transcripciones antes de interpretar.
 */
const { preprocessTranscript } = require('./voiceTranscriptNormalize');
const { expandImplicitCommands } = require('./voiceLocalExpand');

const NUMBER_WORDS = {
  cero: 0,
  uno: 1,
  un: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  veinte: 20,
  treinta: 30,
};

const FILLER =
  /^(?:por favor|porfavor|favor|gracias|ok|okay|okey|listo|eh|este|pues|bueno|a ver|entonces|simplemente)\s+/gi;

const ENTITY_NOUN = '(ticket|tarea|reunion|reuniones|junta|juntas|minuta|minutas|cita|citas)';
const ARTICLE_WORDS = new Set(['un', 'una', 'uno']);

function wordsToDigits(text) {
  let s = text;
  for (const [word, num] of Object.entries(NUMBER_WORDS)) {
    s = s.replace(new RegExp(`\\b(numero|número|num)\\s+${word}\\b`, 'gi'), String(num));
    s = s.replace(
      new RegExp(`\\b${ENTITY_NOUN}\\s+(?:numero|num)?\\s*${word}\\b`, 'gi'),
      `$1 ${num}`,
    );
    // No convertir artículos ("una reunión", "un ticket") — rompe create_meeting y similares.
    if (!ARTICLE_WORDS.has(word)) {
      s = s.replace(new RegExp(`\\b${word}\\s+${ENTITY_NOUN}\\b`, 'gi'), `${num} $1`);
    }
  }
  return s;
}

const REPAIRS = [
  [/\besta\s+activa\b/gi, 'activa'],
  [/\bestan\s+activas\b/gi, 'activas'],
  [/\bpara\s+hoy\b/gi, 'hoy'],
  [/\bpara\s+manana\b/gi, 'mañana'],
  [/\bpara\s+mañana\b/gi, 'mañana'],
  [/\bme\s+puedes\b/gi, ''],
  [/\bpuedes\b/gi, ''],
  [/\bpor\s+favor\b/gi, ''],
  [/\bquisiera\s+saber\b/gi, 'dime'],
  [/\bnecesito\s+saber\b/gi, 'dime'],
  [/\bquiero\s+saber\b/gi, 'dime'],
  [/\bme\s+gustaria\s+saber\b/gi, 'dime'],
  [/\bme\s+gustaría\s+saber\b/gi, 'dime'],
  [/\bcuantas\s+reuniones\b/gi, 'cuántas reuniones'],
  [/\bcuantos\s+tickets\b/gi, 'cuántos tickets'],
  [/\bcuantas\s+tareas\b/gi, 'cuántas tareas'],
  [/\babre\s+me\b/gi, 'abrir'],
  [/\bmuestrame\b/gi, 'muéstrame'],
  [/\bllevame\b/gi, 'llévame'],
  [/\bpasame\b/gi, 'pásame'],
  [/\bentrar\s+a\b/gi, 'ir a'],
  [/\bentra\s+a\b/gi, 'ir a'],
  [/\bpon\s+me\b/gi, 'ponme'],
  [/\bhaz\s+me\b/gi, 'hazme'],
  [/\bcrea\s+me\b/gi, 'crear'],
  [/\bcrear\s+me\b/gi, 'crear'],
  [/\bagenda\s+me\b/gi, 'agendar'],
  [/\bagendar\s+me\b/gi, 'agendar'],
  [/\bcreo\s+(?!que\b)(?:una\s+)?(?:reunion|junta|cita)\b/gi, 'crear una reunion'],
  [/\bcreo\s+(?:un\s+)?ticket\b/gi, 'crear un ticket'],
  [/\bcreo\s+(?:una\s+)?tarea\b/gi, 'crear una tarea'],
  [/\bcriar\s+(?:un\s+)?ticket\b/gi, 'crear un ticket'],
  [/\bcriar\s+(?:una\s+)?tarea\b/gi, 'crear una tarea'],
  [/\bhacer(?:me)?\s+(?:un\s+)?ticket\b/gi, 'crear un ticket'],
  [/\bhacer(?:me)?\s+(?:una\s+)?tarea\b/gi, 'crear una tarea'],
  [/\basigname\s+a\b/gi, 'asignar a'],
  [/\basignarla\s+a\b/gi, 'asignar a'],
  [/\basignarlo\s+a\b/gi, 'asignar a'],
  [/\bcriar\s+(?:una\s+)?(?:reunion|junta|cita)\b/gi, 'crear una reunion'],
  [/\bhacer(?:me)?\s+(?:una\s+)?(?:reunion|junta|cita)\b/gi, 'crear una reunion'],
  [/\bhace\s+(?:una\s+)?(?:reunion|junta|cita)\b/gi, 'crear una reunion'],
  [/\bque\s+crea\b/gi, 'crea'],
  [/\bque\s+crear\b/gi, 'crear'],
  [/\bpara\s+crear\s+(?:una\s+)?(?:reunion|junta|cita)\b/gi, 'crear una reunion'],
  [/\b(crea|crear|agenda|agendar|programa|programar|organiza|organizar|pon|ponme|haz|hazme|quiero|necesito)\s+1\s+(reunion|junta|cita)\b/gi, '$1 una $2'],
  [/\b(crea|crear|agenda|agendar|programa|programar|organiza|organizar|pon|ponme|haz|hazme|quiero|necesito)\s+1\s+(ticket|tarea)\b/gi, '$1 un $2'],
  [/\bticket\s+numero\b/gi, 'ticket'],
  [/\btarea\s+numero\b/gi, 'tarea'],
  [/\breunion\s+numero\b/gi, 'reunion'],
  [/\bnumero\s+(\d+)\b/gi, '#$1'],
  [/\bnúmero\s+(\d+)\b/gi, '#$1'],
  [/\bticket\s+#?\s*(\d+)\s+(?:en|a|como|con)\s+(cerrad|abiert|pendiente|progreso|resuelt|urgent)/gi, 'ticket $1 $2'],
  [/\bticket\s+(\d+)\s+(cerrar|cerrado|cerrada|completar|completado)/gi, 'ticket $1 cerrado'],
  [/\btarea\s+(\d+)\s+(terminar|terminada|completar|completada|cerrar|cerrada)/gi, 'tarea $1 completada'],
  [/\b(soporte|mesa\s+de\s+ayuda)\b/gi, 'tickets'],
  [/\bincidentes\b/gi, 'incidencias'],
  [/\bcomunicaciones\b/gi, 'comunicados'],
  [/\bdame\s+(?:una\s+)?(?:reunion|junta|cita)\b/gi, 'crear una reunion'],
  [/\bdame\s+(?:un\s+)?ticket\b/gi, 'crear un ticket'],
  [/\bdame\s+(?:una\s+)?tarea\b/gi, 'crear una tarea'],
  [/\bpon\s+en\s+el\s+calendario\b/gi, 'agendar'],
  [/\bponlo\s+en\s+el\s+calendario\b/gi, 'agendar'],
  [/\bmete\s+en\s+el\s+calendario\b/gi, 'agendar'],
  [/\bprogramame\s+(?:una\s+)?(?:reunion|junta|cita)\b/gi, 'programar una reunion'],
  [/\bagendame\s+(?:una\s+)?(?:reunion|junta|cita)\b/gi, 'agendar una reunion'],
  [/\b(?:en|para)\s+la\s+tarde\b/gi, 'tarde'],
  [/\b(?:en|para)\s+la\s+manana\b/gi, 'manana'],
  [/\b(?:en|para)\s+la\s+mañana\b/gi, 'mañana'],
  [/\bmedio\s+dia\b/gi, '12:00'],
  [/\bmedio\s+día\b/gi, '12:00'],
  [/\b(?:a\s+las\s+)?once\b/gi, '11:00'],
  [/\b(?:a\s+las\s+)?doce\b/gi, '12:00'],
  [/\b(?:a\s+las\s+)?(\d{1,2})\s+de\s+la\s+(?:manana|mañana|tarde|noche)\b/gi, 'a las $1'],
  [/\b(?:hay|tengo)\s+alguna\s+reunion\b/gi, 'hay reuniones'],
  [/\b(?:hay|tengo)\s+algun\s+ticket\b/gi, 'hay tickets'],
  [/\b(?:hay|tengo)\s+alguna\s+tarea\b/gi, 'hay tareas'],
  [/\blo\s+de\s+(.+?)\s+(manana|mañana|hoy|para|a\s+las)\b/gi, 'reunion $1 $2'],
];

function repairTranscript(text) {
  let s = expandImplicitCommands(preprocessTranscript(text));
  while (FILLER.test(s)) s = s.replace(FILLER, '');
  s = wordsToDigits(s);
  for (const [re, rep] of REPAIRS) s = s.replace(re, rep);
  return s.replace(/\s+/g, ' ').trim();
}

/** Variantes para reintentar parseo si la primera falla. */
function buildParseVariants(text) {
  const base = repairTranscript(text);
  const variants = [base];
  const collapsed = base.replace(/\b(?:el|la|los|las|un|una|de|del|para|con|en|a)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (collapsed && collapsed !== base && collapsed.length >= 4) variants.push(collapsed);
  const noPunct = base.replace(/[?.!,;:]/g, ' ').replace(/\s+/g, ' ').trim();
  if (noPunct !== base) variants.push(noPunct);
  return [...new Set(variants.filter(Boolean))];
}

module.exports = { repairTranscript, buildParseVariants, wordsToDigits };
