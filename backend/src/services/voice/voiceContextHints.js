/**
 * Pistas de contexto BOSA para STT y parseo — generadas desde usuarios/departamentos (gratis, local).
 */

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function userFullName(u) {
  return `${u?.name || ''} ${u?.apellido || ''}`.trim();
}

function buildCatalogHints(users = []) {
  const active = (users || []).filter((u) => u.is_active !== 0);
  const names = [...new Set(active.map(userFullName).filter((n) => n.length > 2))].slice(0, 25);
  const depts = [...new Set(active.map((u) => u.departamento).filter(Boolean))].slice(0, 15);
  const parts = [];

  if (depts.length) parts.push(`Departamentos: ${depts.join(', ')}`);
  if (names.length) parts.push(`Personas: ${names.join(', ')}`);

  return parts.join('. ');
}

function buildWhisperHints(users = [], learnedHints = []) {
  const catalog = buildCatalogHints(users);
  const learned = Array.isArray(learnedHints) ? learnedHints.filter(Boolean).slice(0, 10) : [];
  return [...(catalog ? [catalog] : []), ...learned];
}

module.exports = {
  buildCatalogHints,
  buildWhisperHints,
  userFullName,
  normalizeText,
};
