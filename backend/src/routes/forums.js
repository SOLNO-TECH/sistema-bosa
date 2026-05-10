const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const { authenticate } = require('../middleware/auth');
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
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Todas las rutas de foros requieren autenticación
router.use(authenticate);

// Obtener todos los grupos
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const groups = db.prepare('SELECT * FROM workgroups ORDER BY created_at DESC').all();
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
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

// Actualizar un grupo
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, description, access_type, access_list } = req.body;
    const stmt = db.prepare('UPDATE workgroups SET name = ?, description = ?, access_type = ?, access_list = ? WHERE id = ?');
    stmt.run(name, description, access_type || 'all', JSON.stringify(access_list || []), req.params.id);
    const updatedGroup = db.prepare('SELECT * FROM workgroups WHERE id = ?').get(req.params.id);
    res.json(updatedGroup);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar un grupo
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    // Primero eliminar mensajes del grupo
    db.prepare('DELETE FROM workgroup_messages WHERE workgroup_id = ?').run(req.params.id);
    // Luego eliminar el grupo
    db.prepare('DELETE FROM workgroups WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener mensajes de un grupo
router.get('/:id/messages', (req, res) => {
  try {
    const db = getDb();
    const messages = db.prepare(`
      SELECT m.*, u.name as user_name, u.role as user_role 
      FROM workgroup_messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.workgroup_id = ?
      ORDER BY m.created_at ASC
    `).all(req.params.id);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enviar un mensaje (con posible archivo adjunto)
router.post('/:id/messages', upload.single('file'), (req, res) => {
  try {
    const db = getDb();
    const { content } = req.body;
    // user_id siempre desde el token, no del body (evita suplantación)
    const user_id = req.user?.id;
    if (!user_id) return res.status(401).json({ error: 'No autenticado' });
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
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
