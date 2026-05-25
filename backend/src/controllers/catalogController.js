const { getDb } = require('../database/init');
const { DEFAULT_DEPARTMENTS, DEFAULT_ROLES } = require('../utils/catalogDefaults');
const { roleSlugExists } = require('../utils/roleUtils');

function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function listDepartments(req, res) {
  try {
    const db = getDb();
    const fromCatalog = db.prepare(`
      SELECT name FROM catalog_departments
      WHERE is_active = 1
      ORDER BY sort_order ASC, name ASC
    `).all().map((r) => r.name);

    const fromUsers = db.prepare(`
      SELECT DISTINCT TRIM(departamento) AS name
      FROM users
      WHERE departamento IS NOT NULL AND TRIM(departamento) != ''
    `).all().map((r) => r.name);

    const merged = [...new Set([...fromCatalog, ...fromUsers])].sort((a, b) => a.localeCompare(b, 'es'));
    res.json(merged);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar departamentos' });
  }
}

function listRoles(req, res) {
  try {
    const db = getDb();
    const catalog = db.prepare(`
      SELECT slug, label, permission_level, is_system, sort_order
      FROM catalog_roles
      WHERE is_active = 1
      ORDER BY sort_order ASC, label ASC
    `).all();

    const fromUsers = db.prepare(`
      SELECT DISTINCT TRIM(role) AS slug FROM users
      WHERE role IS NOT NULL AND TRIM(role) != ''
    `).all();

    const bySlug = new Map(catalog.map((r) => [r.slug, r]));
    for (const { slug } of fromUsers) {
      if (!bySlug.has(slug)) {
        bySlug.set(slug, {
          slug,
          label: slug,
          permission_level: 'user',
          is_system: 0,
          sort_order: 999,
        });
      }
    }

    res.json([...bySlug.values()].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.label.localeCompare(b.label, 'es')));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar roles' });
  }
}

function createDepartment(req, res) {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Indica el nombre del departamento' });
    if (name.length > 80) return res.status(400).json({ error: 'Nombre demasiado largo' });

    const db = getDb();
    const exists = db.prepare('SELECT id FROM catalog_departments WHERE LOWER(name) = LOWER(?)').get(name);
    if (exists) return res.status(400).json({ error: 'Ese departamento ya existe' });

    const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM catalog_departments').get();
    db.prepare('INSERT INTO catalog_departments (name, sort_order) VALUES (?, ?)').run(name, (maxSort?.m || 0) + 1);

    res.status(201).json({ message: 'Departamento creado', name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear departamento' });
  }
}

function createRole(req, res) {
  try {
    const label = String(req.body?.label || '').trim();
    let slug = String(req.body?.slug || '').trim() || slugify(label);
    const permission_level = String(req.body?.permission_level || 'user').trim();

    if (!label) return res.status(400).json({ error: 'Indica el nombre del rol' });
    if (!slug || !/^[a-z0-9_]+$/.test(slug)) {
      return res.status(400).json({ error: 'Identificador de rol inválido (solo letras minúsculas, números y _)' });
    }
    if (slug === 'superadmin') {
      return res.status(400).json({ error: 'No se puede crear otro rol superadmin' });
    }
    const allowedLevels = ['administrator', 'manager', 'user'];
    if (!allowedLevels.includes(permission_level)) {
      return res.status(400).json({ error: 'Nivel de permiso no válido' });
    }

    const db = getDb();
    if (roleSlugExists(db, slug)) {
      return res.status(400).json({ error: 'Ese rol ya existe' });
    }

    const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM catalog_roles').get();
    db.prepare(`
      INSERT INTO catalog_roles (slug, label, permission_level, is_system, sort_order)
      VALUES (?, ?, ?, 0, ?)
    `).run(slug, label, permission_level, (maxSort?.m || 0) + 1);

    res.status(201).json({
      message: 'Rol creado',
      role: { slug, label, permission_level, is_system: 0 },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear rol' });
  }
}

function seedCatalogIfEmpty(db) {
  const deptCount = db.prepare('SELECT COUNT(*) AS c FROM catalog_departments').get()?.c || 0;
  if (deptCount === 0) {
    const ins = db.prepare('INSERT OR IGNORE INTO catalog_departments (name, sort_order) VALUES (?, ?)');
    DEFAULT_DEPARTMENTS.forEach((name, i) => ins.run(name, i));
  }
  const roleCount = db.prepare('SELECT COUNT(*) AS c FROM catalog_roles').get()?.c || 0;
  if (roleCount === 0) {
    const ins = db.prepare(`
      INSERT OR IGNORE INTO catalog_roles (slug, label, permission_level, is_system, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);
    DEFAULT_ROLES.forEach((r) => ins.run(r.slug, r.label, r.permission_level, r.is_system, r.sort_order));
  }
}

module.exports = {
  listDepartments,
  listRoles,
  createDepartment,
  createRole,
  seedCatalogIfEmpty,
};
