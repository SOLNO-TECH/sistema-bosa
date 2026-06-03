/**
 * Corrige errores típicos del reconocimiento de voz en español antes de interpretar.
 */
function preprocessTranscript(text) {
  let s = String(text || '').trim();
  if (!s) return s;

  s = s
    .replace(/^\[(?:subtitle|subtitulo|música|music|silence|inaudible)[^\]]*\]\s*/gi, '')
    .replace(/^(?:oye\s+)?saya\s*,?\s*/i, '')
    .replace(/^(?:ok|bien|eh+|um+|mmm+|a ver|o sea|pues|bueno)\s*,?\s*/i, '');

  const fixes = [
    [/\breu\s*n\s*iones\b/gi, 'reuniones'],
    [/\breu\s*n\s*ion\b/gi, 'reunion'],
    [/\bre\s+uni[oó]n\b/gi, 'reunion'],
    [/\bre\s+union\b/gi, 'reunion'],
    [/\bre\s*nion\b/gi, 'reunion'],
    [/\bjun\s+ta\b/gi, 'junta'],
    [/\bjun\s+tas\b/gi, 'juntas'],
    [/\btick\s*et\b/gi, 'ticket'],
    [/\btick\s*ets\b/gi, 'tickets'],
    [/\btiket\b/gi, 'ticket'],
    [/\btikets\b/gi, 'tickets'],
    [/\btiquet\b/gi, 'ticket'],
    [/\bmanana\b/gi, 'mañana'],
    [/\bpasado manana\b/gi, 'pasado mañana'],
    [/\bd[ií]a de manana\b/gi, 'mañana'],
    [/\bd[ií]a de mañana\b/gi, 'mañana'],
    [/\bt[ií]tulo\b/gi, 'titulo'],
    [/\bdescripci[oó]n\b/gi, 'descripcion'],
    [/\bde\s+partamentos\b/gi, 'departamentos'],
    [/\bde\s+partamento\b/gi, 'departamento'],
    [/\bagenda me\b/gi, 'agendar'],
    [/\bagenda r\b/gi, 'agendar'],
    [/\bprograma me\b/gi, 'programar'],
    [/\bcrea me\b/gi, 'crear'],
    [/\bpublica me\b/gi, 'publicar'],
    [/\bpara las (\d{1,2})\b/gi, 'a las $1'],
    [/\b(\d{1,2})\s+de la tarde\b/gi, '$1 pm'],
    [/\b(\d{1,2})\s+de la mañana\b/gi, '$1 am'],
    [/\b(\d{1,2})\s+de la noche\b/gi, '$1 pm'],
    [/\bmedia noche\b/gi, '12:00 am'],
    [/\bmedio dia\b/gi, '12:00 pm'],
    [/\bmedio día\b/gi, '12:00 pm'],
    [/\bme gustaria\b/gi, 'me gustaría'],
    [/\bquisiera\b/gi, 'quisiera'],
    [/\bpodrias\b/gi, 'podrías'],
    [/\bpuedes decirme\b/gi, 'dime'],
    [/\bque hay\b/gi, 'qué hay'],
    [/\bque tengo\b/gi, 'qué tengo'],
    [/\bcuantas\b/gi, 'cuántas'],
    [/\bcuantos\b/gi, 'cuántos'],
    [/\bcual\b/gi, 'cuál'],
    [/\bcomo esta\b/gi, 'cómo está'],
    [/\bcomo estan\b/gi, 'cómo están'],
    [/\bnotificacion\b/gi, 'notificación'],
    [/\babre el calendario\b/gi, 'abrir calendario'],
    [/\babre los tickets\b/gi, 'abrir tickets'],
    [/\bver mis tickets\b/gi, 'mis tickets'],
    [/\bver mis reuniones\b/gi, 'mis reuniones'],
    [/\bque reuniones\b/gi, 'qué reuniones'],
    [/\bque tickets\b/gi, 'qué tickets'],
    [/\bque tareas\b/gi, 'qué tareas'],
    [/\bmuestrame\b/gi, 'muéstrame'],
    [/\bmuestra me\b/gi, 'muéstrame'],
    [/\bllevame\b/gi, 'llévame'],
    [/\blleva me\b/gi, 'llévame'],
    [/\bpasame\b/gi, 'pásame'],
    [/\bincidente\b/gi, 'incidencia'],
    [/\bincidentes\b/gi, 'incidencias'],
    [/\bcomunicados\b/gi, 'comunicados'],
    [/\bactas\b/gi, 'actas'],
    [/\bproxima reunion\b/gi, 'próxima reunión'],
    [/\bproximo\b/gi, 'próximo'],
    [/\bsin leer\b/gi, 'sin leer'],
    [/\bno leidos\b/gi, 'no leídos'],
    [/\bconfirmar\b/gi, 'confirmar'],
    [/\b(\d+)\s+pm\b/gi, '$1 pm'],
    [/\b(\d+)\s+am\b/gi, '$1 am'],
    [/\ba las (\d{1,2})\s+pm\b/gi, 'a las $1 pm'],
    [/\ba las (\d{1,2})\s+am\b/gi, 'a las $1 am'],
  ];

  for (const [re, rep] of fixes) s = s.replace(re, rep);
  return s.replace(/\s+/g, ' ').trim();
}

module.exports = { preprocessTranscript };
