const { getDb } = require('../database/init');
const { notifyUser } = require('../services/notificationService');
const { notifyTicketStakeholders } = require('../utils/participantNotify');
const { canManageDeptTicketAssignments } = require('../utils/ticketPermissions');

function canViewTicket(user, ticket) {
  if (!user || !ticket) return false;
  if (user.role === 'superadmin' || user.role === 'administrator') return true;
  const cat = (ticket.category || '').trim();
  const dept = (user.departamento || '').trim();
  if (cat && dept === cat) return true;
  if (Number(ticket.created_by) === Number(user.id)) return true;
  if (ticket.assigned_to != null && Number(ticket.assigned_to) === Number(user.id)) return true;
  return false;
}

function canSeeTaskRow(user, row) {
  if (!user) return false;
  if (user.role === 'superadmin' || user.role === 'administrator') return true;
  const cat = (row.ticket_category || '').trim();
  const dept = (user.departamento || '').trim();
  if (cat && dept === cat) return true;
  if (Number(row.assigned_to) === Number(user.id)) return true;
  if (Number(row.created_by) === Number(user.id)) return true;
  return false;
}

function getTicket(db, id) {
  return db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
}

const listTasks = (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT tt.*,
        t.title as ticket_title, t.category as ticket_category, t.status as ticket_status,
        u1.name as assignee_name, u1.apellido as assignee_apellido,
        u2.name as creator_name
      FROM ticket_tasks tt
      JOIN tickets t ON tt.ticket_id = t.id
      LEFT JOIN users u1 ON tt.assigned_to = u1.id
      LEFT JOIN users u2 ON tt.created_by = u2.id
      ORDER BY tt.start_date ASC, tt.id ASC
    `).all();
    res.json(rows.filter((r) => canSeeTaskRow(req.user, r)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar tareas' });
  }
};

const listTasksByTicket = (req, res) => {
  try {
    const { ticketId } = req.params;
    const db = getDb();
    const ticket = getTicket(db, ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    if (!canViewTicket(req.user, ticket)) {
      return res.status(403).json({ error: 'Sin permiso para ver tareas de este ticket' });
    }
    const rows = db.prepare(`
      SELECT tt.*,
        u1.name as assignee_name, u1.apellido as assignee_apellido,
        u2.name as creator_name
      FROM ticket_tasks tt
      LEFT JOIN users u1 ON tt.assigned_to = u1.id
      LEFT JOIN users u2 ON tt.created_by = u2.id
      WHERE tt.ticket_id = ?
      ORDER BY tt.start_date ASC, tt.id ASC
    `).all(ticketId);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar tareas del ticket' });
  }
};

const createTask = (req, res) => {
  try {
    const { ticketId } = req.params;
    const user_id = req.user?.id;
    if (!user_id) return res.status(401).json({ error: 'No autenticado' });

    const { title, description, assigned_to, start_date, end_date } = req.body || {};
    if (!title || !String(title).trim()) return res.status(400).json({ error: 'Título requerido' });
    if (assigned_to == null || assigned_to === '') return res.status(400).json({ error: 'Indica responsable' });
    if (!start_date || !end_date) return res.status(400).json({ error: 'Fechas de inicio y fin requeridas' });

    const db = getDb();
    const ticket = getTicket(db, ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    if (!canManageDeptTicketAssignments(req.user, ticket)) {
      return res.status(403).json({
        error: 'Solo un usuario con rol Gerente del mismo departamento o un administrador puede crear tareas operativas.',
      });
    }

    const assignee = db.prepare('SELECT id, departamento, is_active, name FROM users WHERE id = ?').get(Number(assigned_to));
    if (!assignee || !assignee.is_active) return res.status(400).json({ error: 'Responsable no válido' });
    if ((assignee.departamento || '').trim() !== (ticket.category || '').trim()) {
      return res.status(400).json({ error: 'El responsable debe pertenecer al departamento del ticket.' });
    }

    const s = String(start_date).slice(0, 10);
    const e = String(end_date).slice(0, 10);
    if (s > e) return res.status(400).json({ error: 'La fecha de fin debe ser igual o posterior al inicio' });

    const info = db.prepare(`
      INSERT INTO ticket_tasks (ticket_id, title, description, assigned_to, created_by, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      ticketId,
      String(title).trim(),
      description ? String(description).trim() : '',
      assignee.id,
      user_id,
      s,
      e
    );

    const taskId = info.lastInsertRowid;
    try {
      if (assignee.id !== user_id) {
        notifyUser(assignee.id, {
          type: 'task',
          title: 'Tarea operativa asignada',
          message: `"${String(title).trim()}" · Ticket: ${ticket.title}`,
          module: 'tasks',
          related_id: Number(taskId),
          link_id: Number(ticketId),
        });
      }
      const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(user_id);
      notifyTicketStakeholders(
        db,
        ticketId,
        user_id,
        {
          type: 'task',
          title: 'Nueva tarea operativa',
          message: `${actor?.name || 'Alguien'} creó la tarea "${String(title).trim()}" en "${ticket.title}".`,
          module: 'tasks',
          related_id: Number(ticketId),
          link_id: Number(ticketId),
        },
        assignee.id !== user_id ? [assignee.id] : []
      );
    } catch (_) { /* noop */ }

    const row = db.prepare(`
      SELECT tt.*, u1.name as assignee_name, u1.apellido as assignee_apellido, u2.name as creator_name
      FROM ticket_tasks tt
      LEFT JOIN users u1 ON tt.assigned_to = u1.id
      LEFT JOIN users u2 ON tt.created_by = u2.id
      WHERE tt.id = ?
    `).get(taskId);
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear tarea' });
  }
};

const updateTask = (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user?.id;
    if (!user_id) return res.status(401).json({ error: 'No autenticado' });

    const db = getDb();
    const task = db.prepare('SELECT * FROM ticket_tasks WHERE id = ?').get(id);
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });
    const ticket = getTicket(db, task.ticket_id);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

    const isManager = canManageDeptTicketAssignments(req.user, ticket);
    const isAssignee = Number(task.assigned_to) === Number(user_id);
    const patch = req.body || {};

    if (isManager) {
      const allowed = ['title', 'description', 'assigned_to', 'start_date', 'end_date', 'status'];
      const updates = [];
      const values = [];
      for (const k of allowed) {
        if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
        if (k === 'assigned_to') {
          const aid = Number(patch[k]);
          const assignee = db.prepare('SELECT id, departamento, is_active FROM users WHERE id = ?').get(aid);
          if (!assignee || !assignee.is_active) return res.status(400).json({ error: 'Responsable no válido' });
          if ((assignee.departamento || '').trim() !== (ticket.category || '').trim()) {
            return res.status(400).json({ error: 'El responsable debe ser del departamento del ticket.' });
          }
        }
        updates.push(`${k} = ?`);
        values.push(patch[k]);
      }
      if (updates.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
      if (Object.prototype.hasOwnProperty.call(patch, 'start_date') || Object.prototype.hasOwnProperty.call(patch, 'end_date')) {
        const cur = db.prepare('SELECT start_date, end_date FROM ticket_tasks WHERE id = ?').get(id);
        const ns = Object.prototype.hasOwnProperty.call(patch, 'start_date') ? String(patch.start_date).slice(0, 10) : cur.start_date;
        const ne = Object.prototype.hasOwnProperty.call(patch, 'end_date') ? String(patch.end_date).slice(0, 10) : cur.end_date;
        if (ns > ne) return res.status(400).json({ error: 'La fecha de fin debe ser igual o posterior al inicio' });
      }
      values.push(id);
      db.prepare(`UPDATE ticket_tasks SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
    } else if (isAssignee) {
      const keys = Object.keys(patch);
      if (keys.some((k) => k !== 'status')) {
        return res.status(403).json({ error: 'Solo puedes actualizar el estado de tu tarea' });
      }
      if (!Object.prototype.hasOwnProperty.call(patch, 'status')) {
        return res.status(400).json({ error: 'Indica el estado' });
      }
      const st = patch.status;
      if (!['pending', 'in_progress', 'done', 'cancelled'].includes(st)) {
        return res.status(400).json({ error: 'Estado no válido' });
      }
      db.prepare(`UPDATE ticket_tasks SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(st, id);
    } else {
      return res.status(403).json({ error: 'Sin permiso' });
    }

    const row = db.prepare(`
      SELECT tt.*, t.title as ticket_title, t.category as ticket_category, t.status as ticket_status,
        u1.name as assignee_name, u1.apellido as assignee_apellido, u2.name as creator_name
      FROM ticket_tasks tt
      JOIN tickets t ON tt.ticket_id = t.id
      LEFT JOIN users u1 ON tt.assigned_to = u1.id
      LEFT JOIN users u2 ON tt.created_by = u2.id
      WHERE tt.id = ?
    `).get(id);

    try {
      const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(user_id);
      notifyTicketStakeholders(db, task.ticket_id, user_id, {
        type: 'task',
        title: 'Tarea operativa actualizada',
        message: `${actor?.name || 'Alguien'} actualizó "${row?.title || task.title}" (${row?.ticket_title || ticket.title}).`,
        module: 'tasks',
        related_id: Number(task.ticket_id),
        link_id: Number(task.ticket_id),
      });
    } catch (_) { /* noop */ }

    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar tarea' });
  }
};

const deleteTask = (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user?.id;
    if (!user_id) return res.status(401).json({ error: 'No autenticado' });
    const db = getDb();
    const task = db.prepare('SELECT * FROM ticket_tasks WHERE id = ?').get(id);
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });
    const ticket = getTicket(db, task.ticket_id);
    if (!canManageDeptTicketAssignments(req.user, ticket)) {
      return res.status(403).json({ error: 'Sin permiso para eliminar la tarea' });
    }
    try {
      const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(user_id);
      notifyTicketStakeholders(db, task.ticket_id, user_id, {
        type: 'task',
        title: 'Tarea operativa eliminada',
        message: `${actor?.name || 'Alguien'} eliminó la tarea "${task.title}" del ticket.`,
        module: 'tasks',
        related_id: Number(task.ticket_id),
        link_id: Number(task.ticket_id),
      });
    } catch (_) { /* noop */ }

    db.prepare('DELETE FROM ticket_tasks WHERE id = ?').run(id);
    res.json({ message: 'Tarea eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar tarea' });
  }
};

module.exports = {
  listTasks,
  listTasksByTicket,
  createTask,
  updateTask,
  deleteTask,
};
