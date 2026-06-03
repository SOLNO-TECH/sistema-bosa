function whisperPrompt(userHints = [], catalogHints = '') {
  const base =
    process.env.WHISPER_PROMPT ||
    'Comandos de voz BOSA en español mexicano. Palabras clave: reunión, junta, calendario, agenda, ticket, incidencia, tarea, aviso, minuta, agendar, crear, abrir, cerrar, confirmar, hoy, mañana, departamento, prioridad, asignar, participantes, consultar, qué hay, cuántas, mis tickets, mis reuniones, abrir calendario, ir a tickets, muéstrame, llévame, pendientes, sin leer, próxima reunión, reportar problema, no funciona, virtual, sala de juntas, semanal, quincenal.';

  const parts = [base];
  if (catalogHints) parts.push(catalogHints);
  const hints = Array.isArray(userHints) ? userHints.filter(Boolean).slice(0, 12) : [];
  if (hints.length) parts.push(`Frases habituales: ${hints.join('; ')}.`);
  return parts.join(' ');
}

module.exports = { whisperPrompt };
