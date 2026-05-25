/** Valores iniciales del catálogo (solo seed; no modifica filas de users). */
const DEFAULT_DEPARTMENTS = [
  'Obra Civil', 'Proyectos', 'Diseño', 'Acabados', 'Eléctricos',
  'HVAC', 'Hidrosanitarios', 'Sistemas', 'Contabilidad', 'Finanzas',
  'Recursos Humanos', 'Jurídico', 'Compras', 'Costos', 'Operaciones',
  'Mantenimiento', 'Almacén', 'Marketing', 'Restaurantes', 'Berry Yum',
];

const DEFAULT_ROLES = [
  { slug: 'superadmin', label: 'Super Administrador', permission_level: 'superadmin', is_system: 1, sort_order: 0 },
  { slug: 'administrator', label: 'Administrador', permission_level: 'administrator', is_system: 1, sort_order: 1 },
  { slug: 'manager', label: 'Gerente', permission_level: 'manager', is_system: 1, sort_order: 2 },
];

module.exports = { DEFAULT_DEPARTMENTS, DEFAULT_ROLES };
