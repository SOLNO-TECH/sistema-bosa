const VALID_LOCATION_TYPES = ['virtual', 'sala_juntas', 'other'];

function capitalizeFirstLetter(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function normalizeLocationType(value) {
  return VALID_LOCATION_TYPES.includes(value) ? value : 'sala_juntas';
}

function normalizeLocationCustom(raw, locationType) {
  if (locationType !== 'other') return null;
  const text = capitalizeFirstLetter(raw);
  return text || null;
}

function normalizeMeetingDepartment(raw) {
  const d = String(raw || '').trim();
  return d || null;
}

function meetingLocationLabel(meeting) {
  const type = normalizeLocationType(meeting?.location_type);
  if (type === 'virtual') return 'Reunión virtual';
  if (type === 'other') return meeting?.location_custom || 'Otro';
  return 'Sala de juntas';
}

function meetingPlaceLabelForMinute(meeting) {
  const type = normalizeLocationType(meeting?.location_type);
  if (type === 'virtual') return 'Reunión virtual';
  if (type === 'other') return meeting?.location_custom || 'Otro';
  return 'Sala de juntas corporativo';
}

function parseMeetingLocationInput(body, existing = null) {
  const location_type = normalizeLocationType(body?.location_type ?? existing?.location_type);
  const location_custom = normalizeLocationCustom(
    body?.location_custom ?? existing?.location_custom,
    location_type,
  );
  if (location_type === 'other' && !location_custom) {
    return { error: 'Indica la modalidad personalizada (Otro).' };
  }
  const department = normalizeMeetingDepartment(body?.department ?? existing?.department);
  return { location_type, location_custom, department };
}

module.exports = {
  VALID_LOCATION_TYPES,
  capitalizeFirstLetter,
  normalizeLocationType,
  normalizeLocationCustom,
  normalizeMeetingDepartment,
  meetingLocationLabel,
  meetingPlaceLabelForMinute,
  parseMeetingLocationInput,
};
