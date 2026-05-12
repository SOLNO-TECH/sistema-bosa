const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const { authenticate } = require('../middleware/auth');
const { fileFilter } = require('../middleware/uploadFilter');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../data/uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Todas las rutas de foros requieren autenticación
router.use(authenticate);

// ── Helpers de acceso ─────────────────────────────────────
function parseAccessList(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try { return JSON.parse(raw) || []; } catch { return []; }
}

/**
 * Determina si un usuario puede ver/participar en un grupo dado.
 * - El creador siempre puede
 * - Superadmin siempre puede (moderación)
 * - Si access_type === 'all' → todos
 * - Si access_type === 'department' → usuarios del departamento listado
 * - Si access_type === 'users' → usuarios específicos por id
 */
function userHasAccessToGroup(db, userId, group) {
  if (!group) return false;
  const u = db.prepare('SELECT id, role, departamento FROM users WHERE id = ?').get(userId);
  if (!u) return false;

  if (group.created_by === u.id) return true;
  if (u.role === 'superadmin') return true;

  const accessType = group.access_type || 'all';
  const list = parseAccessList(group.access_list);

  if (accessType === 'all') return true;
  if (accessType === 'department') return !!u.departamento && list.includes(u.departamento);
  if (accessType === 'users')      return list.includes(u.id);
  return false;
}

// Listar grupos (filtrados por acceso del usuario actual)
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const groups = db.prepare('SELECT * FROM workgroups ORDER BY created_at DESC').all();
    const visible = groups.filter(g => userHasAccessToGroup(db, userId, g));
    res.json(visible);
  } catch (error) {
    console.error('GET /forums error:', error);
    res.status(500).json({ error: 'Error al obtener grupos' });
  }
});

// Crear un nuevo grupo
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name, description, access_type, access_list } = req.body;
    const created_by = req.user?.id;
    if (!created_by) return res.status(401).json({ error: 'No autenticado' });
    if (!name) return res.status(400).json({ error: 'Nombre del grupo requerido' });
    const stmt = db.prepare('INSERT INTO workgroups (name, description, created_by, access_type, access_list) VALUES (?, ?, ?, ?, ?)');
    const info = stmt.run(name, description, created_by, access_type || 'all', JSON.stringify(access_list || []));
    const newGroup = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(info.lastInsertRowid);
    res.json(newGroup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear grupo' });
  }
});

// Actualizar un grupo (solo creador o superadmin)
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const group = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });

    const isOwner = group.created_by === userId;
    const isSuperAdmin = req.user.role === 'superadmin';
    if (!isOwner && !isSuperAdmin) {
      return res.status(403).json({ error: 'Solo el creador del grupo o un Super Admin puede editarlo' });
    }

    const { name, description, access_type, access_list } = req.body;
    const stmt = db.prepare('UPDATE workgroups SET name = ?, description = ?, access_type = ?, access_list = ? WHERE id = ?');
    stmt.run(name, description, access_type || 'all', JSON.stringify(access_list || []), req.params.id);
    const updatedGroup = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(req.params.id);
    res.json(updatedGroup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar grupo' });
  }
});

// Eliminar un grupo (solo creador o superadmin)
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const group = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });

    const isOwner = group.created_by === userId;
    const isSuperAdmin = req.user.role === 'superadmin';
    if (!isOwner && !isSuperAdmin) {
      return res.status(403).json({ error: 'Solo el creador del grupo o un Super Admin puede eliminarlo' });
    }

    db.prepare('DELETE FROM workgroup_messages WHERE workgroup_id = ?').run(req.params.id);
    db.prepare('DELETE FROM workgroups WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar grupo' });
  }
});

// Obtener mensajes de un grupo (solo si el usuario tiene acceso)
router.get('/:id/messages', (req, res) => {
  try {
    const db = getDb();
    const group = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });
    if (!userHasAccessToGroup(db, req.user.id, group)) {
      return res.status(403).json({ error: 'No tienes acceso a este grupo' });
    }

    const messages = db.prepare(`
      SELECT m.*, u.name as user_name, u.role as user_role
      FROM workgroup_messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.workgroup_id = ?
      ORDER BY m.created_at ASC
    `).all(req.params.id);
    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

// Enviar un mensaje (solo si el usuario tiene acceso al grupo)
router.post('/:id/messages', upload.single('file'), (req, res) => {
  try {
    const db = getDb();
    const user_id = req.user?.id;
    if (!user_id) return res.status(401).json({ error: 'No autenticado' });

    const group = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });
    if (!userHasAccessToGroup(db, user_id, group)) {
      // Si subió archivo pero no tiene acceso, intentar borrarlo del disco
      try {
        if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      } catch (_) {}
      return res.status(403).json({ error: 'No tienes acceso a este grupo' });
    }

    const { content } = req.body;
    let file_url = null;
    let file_name = null;
    if (req.file) {
      file_url = '/api/uploads/' + req.file.filename;
      file_name = req.file.originalname;
    }

    const stmt = db.prepare('INSERT INTO workgroup_messages (workgroup_id, user_id, content, file_url, file_name) VALUES (?, ?, ?, ?, ?)');
    const info = stmt.run(req.params.id, user_id, content || '', file_url, file_name);

    const newMessage = db.prepare(`
      SELECT m.*, u.name as user_name, u.role as user_role
      FROM workgroup_messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.id = ?
    `).get(info.lastInsertRowid);

    res.json(newMessage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

module.exports = router;
