export const FALLBACK_DEPARTMENTS = [
  'Obra Civil', 'Proyectos', 'Diseño', 'Acabados', 'Eléctricos',
  'HVAC', 'Hidrosanitarios', 'Sistemas', 'Contabilidad', 'Finanzas',
  'Recursos Humanos', 'Jurídico', 'Compras', 'Costos', 'Operaciones',
  'Mantenimiento', 'Almacén', 'Marketing', 'Restaurantes', 'Berry Yum',
];

export const FALLBACK_ROLES = [
  { slug: 'superadmin', label: 'Super Administrador', permission_level: 'superadmin' },
  { slug: 'administrator', label: 'Administrador', permission_level: 'administrator' },
  { slug: 'manager', label: 'Gerente', permission_level: 'manager' },
];

export function roleLabelFromCatalog(slug, roles = FALLBACK_ROLES) {
  const found = roles.find((r) => r.slug === slug);
  if (found) return found.label;
  if (slug === 'superadmin') return 'Super Admin';
  if (slug === 'manager') return 'Gerente';
  if (slug === 'administrator') return 'Administrador';
  return slug || '—';
}

export function roleBadgeClass(slug, permissionLevel) {
  const level = permissionLevel
    || (slug === 'superadmin' ? 'superadmin' : slug === 'manager' ? 'manager' : slug === 'administrator' ? 'administrator' : 'user');
  if (level === 'superadmin') return 'border-gold text-gold font-bold';
  if (level === 'manager') return 'border-navy-400 text-navy-800 font-bold';
  return 'border-gray-200 text-navy-700 font-bold';
}
