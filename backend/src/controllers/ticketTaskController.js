const fs = require('fs');
const { getDb } = require('../database/init');
const { notifyUser } = require('../services/notificationService');
const { sendTaskNotification } = require('../services/emailService');
const { notifyTicketStakeholders } = require('../utils/participantNotify');
const { canManageDeptTicketAssignments, canAssignTicketTramo } = require('../utils/ticketPermissions');

function actorDisplayName(db, userId) {
  const u = db.prepare('SELECT name, apellido FROM users WHERE id = ?').get(userId);
  if (!u) return 'Un responsable';
  return [u.name, u.apellido].filter(Boolean).join(' ').trim() || u.name;
}

function notifyAndEmailTaskAssignee(db, assigneeId, actorId, { taskTitle, ticket, department, startDate, endDate, taskId }) {
  if (!assigneeId || Number(assigneeId) === Number(actorId)) return;

  const assignee = db.prepare('SELECT id, name, email FROM users WHERE id = ? AND is_active = 1').get(Number(assigneeId));
  if (!assignee) return;

  const title = String(taskTitle || '').trim() || 'Tarea operativa';
  const ticketTitle = ticket?.title || '';
  const dept = (ticket?.category || department || '').trim();
  const contextLabel = ticketTitle
    ? `Ticket: ${ticketTitle}`
    : (dept ? `Depto. ${dept}` : 'Tarea independiente');

  notifyUser(assignee.id, {
    type: 'task',
    title: 'Tarea operativa asignada',
    message: `"${title}" · ${contextLabel}`,
    module: 'tasks',
    related_id: Number(taskId),
    link_id: ticket?.id != null ? Number(ticket.id) : null,
  });

  if (assignee.email) {
    sendTaskNotification(assignee.name, assignee.email, {
      title,
      ticket_id: ticket?.id ?? null,
      ticket_title: ticketTitle,
      department: dept,
      assigned_by_name: actorDisplayName(db, actorId),
      start_date: startDate,
      end_date: endDate,
    }).catch((err) => console.warn('sendTaskNotification:', err.message));
  }
}

function taskEffectiveDept(row) {
  return (row?.ticket_category || row?.department || '').trim();
}

function resolvePermissionLevel(user) {
  if (!user) return 'user';
  if (user.permission_level) return user.permission_level;
  if (user.role === 'superadmin') return 'superadmin';
  if (user.role === 'administrator') return 'administrator';
  if (user.role === 'manager') return 'manager';
  return 'user';
}

function isSuperadminUser(user) {
  return resolvePermissionLevel(user) === 'superadmin';
}

/** Evita doble clic / doble envío en ventana corta. */
function findRecentDuplicateTask(db, fields) {
  const {
    created_by,
    assigned_to,
    start_date,
    end_date,
    title,
    ticket_id = null,
    department = '',
    windowSeconds = 45,
  } = fields;
  const titleNorm = String(title || '').trim();
  const s = String(start_date).slice(0, 10);
  const e = String(end_date).slice(0, 10);
  const dept = String(department || '').trim();

  if (ticket_id != null && ticket_id !== '') {
    return db.prepare(`
      SELECT tt.*,
        u1.name as assignee_name, u1.apellido as assignee_apellido,
        u2.name as creator_name
      FROM ticket_tasks tt
      LEFT JOIN users u1 ON tt.assigned_to = u1.id
      LEFT JOIN users u2 ON tt.created_by = u2.id
      WHERE tt.ticket_id = ?
        AND tt.assigned_to = ?
        AND tt.start_date = ?
        AND tt.end_date = ?
        AND tt.created_by = ?
        AND datetime(tt.created_at) >= datetime('now', ? || ' seconds')
      ORDER BY tt.id DESC
      LIMIT 1
    `).get(Number(ticket_id), Number(assigned_to), s, e, Number(created_by), `-${windowSeconds}`);
  }

  return db.prepare(`
    SELECT tt.*,
      u1.name as assignee_name, u1.apellido as assignee_apellido,
      u2.name as creator_name
    FROM ticket_tasks tt
    LEFT JOIN users u1 ON tt.assigned_to = u1.id
    LEFT JOIN users u2 ON tt.created_by = u2.id
    WHERE (tt.ticket_id IS NULL OR tt.ticket_id = '')
      AND TRIM(COALESCE(tt.department, '')) = ?
      AND TRIM(tt.title) = ?
      AND tt.assigned_to = ?
      AND tt.start_date = ?
      AND tt.end_date = ?
      AND tt.created_by = ?
      AND datetime(tt.created_at) >= datetime('now', ? || ' seconds')
    ORDER BY tt.id DESC
    LIMIT 1
  `).get(dept, titleNorm, Number(assigned_to), s, e, Number(created_by), `-${windowSeconds}`);
}

/** Un mismo usuario solo puede tener una tarea por ticket. */
function findAssigneeTaskOnTicket(db, ticketId, assigneeId, excludeTaskId = null) {
  if (ticketId == null || ticketId === '' || assigneeId == null || assigneeId === '') return null;
  const tid = Number(ticketId);
  const aid = Number(assigneeId);
  if (Number.isNaN(tid) || Number.isNaN(aid)) return null;
  if (excludeTaskId != null && excludeTaskId !== '') {
    return db.prepare(`
      SELECT id FROM ticket_tasks
      WHERE ticket_id = ? AND assigned_to = ? AND id != ?
      LIMIT 1
    `).get(tid, aid, Number(excludeTaskId));
  }
  return db.prepare(`
    SELECT id FROM ticket_tasks
    WHERE ticket_id = ? AND assigned_to = ?
    LIMIT 1
  `).get(tid, aid);
}

function canManageTaskByDept(user, department) {
  if (!user) return false;
  const level = user.permission_level
    || (user.role === 'superadmin' ? 'superadmin'
      : user.role === 'administrator' ? 'administrator'
        : user.role === 'manager' ? 'manager' : 'user');
  if (level === 'superadmin' || level === 'administrator') return true;
  if (level !== 'manager') return false;
  const dept = String(department || '').trim();
  const userDept = (user.departamento || '').trim();
  return Boolean(dept && userDept === dept);
}

function canManageTaskRow(user, row) {
  return canManageTaskByDept(user, taskEffectiveDept(row));
}

/** Solo quien creó la tarea o el ticket vinculado (o superadmin). */
function isTaskOrTicketCreator(user, row, ticket) {
  if (!user || !row) return false;
  if (isSuperadminUser(user)) return true;
  if (Number(row.created_by) === Number(user.id)) return true;
  const ticketCreator = ticket?.created_by ?? row.ticket_created_by;
  if (ticketCreator != null && Number(ticketCreator) === Number(user.id)) return true;
  return false;
}

function isTicketCoordinator(user, ticket) {
  if (!user || !ticket) return false;
  if (ticket.assigned_to == null || ticket.assigned_to === '') return false;
  return Number(ticket.assigned_to) === Number(user.id);
}

function canUpdateTaskFields(user, task, ticket, patch) {
  if (isTaskOrTicketCreator(user, task, ticket)) return true;
  if (!isTicketCoordinator(user, ticket)) return false;
  const keys = Object.keys(patch || {}).filter((k) =>
    ['title', 'description', 'assigned_to', 'start_date', 'end_date', 'status'].includes(k),
  );
  return keys.length === 1 && keys[0] === 'status';
}

function notifyTaskCompletionRequest(db, task, ticket, actorId) {
  const actorName = actorDisplayName(db, actorId);
  const ticketLabel = ticket?.title ? ` del ticket "${ticket.title}"` : '';
  const payload = {
    type: 'task',
    title: 'Trabajo listo para revisión',
    message: `${actorName} reportó que terminó la tarea "${task.title}"${ticketLabel}. Revisa la evidencia y confirma.`,
    module: 'tasks',
    related_id: Number(task.id),
    link_id: task.ticket_id != null ? Number(task.ticket_id) : Number(task.id),
  };

  const coordinatorId = ticket?.assigned_to;
  if (coordinatorId && Number(coordinatorId) !== Number(actorId)) {
    notifyUser(Number(coordinatorId), payload);
    return;
  }

  if (task.created_by && Number(task.created_by) !== Number(actorId)) {
    notifyUser(Number(task.created_by), payload);
  }
}

function getTaskContext(db, task) {
  if (task?.ticket_id) {
    const ticket = getTicket(db, task.ticket_id);
    return {
      ticket,
      department: (ticket?.category || task.department || '').trim(),
      linkedToTicket: true,
    };
  }
  return {
    ticket: null,
    department: (task?.department || '').trim(),
    linkedToTicket: false,
  };
}

function validateAssigneeInDept(db, assigneeId, department) {
  const assignee = db.prepare('SELECT id, departamento, is_active, name FROM users WHERE id = ?').get(Number(assigneeId));
  if (!assignee || !assignee.is_active) return { error: 'Responsable no válido' };
  if ((assignee.departamento || '').trim() !== String(department || '').trim()) {
    return { error: 'El responsable debe pertenecer al departamento indicado.' };
  }
  return { assignee };
}

function canViewTicket(user, ticket) {
  if (!user || !ticket) return false;
  const level = user.permission_level
    || (user.role === 'superadmin' ? 'superadmin'
      : user.role === 'administrator' ? 'administrator'
        : user.role === 'manager' ? 'manager' : 'user');
  if (level === 'superadmin' || level === 'administrator') return true;
  const cat = (ticket.category || '').trim();
  const dept = (user.departamento || '').trim();
  if (cat && dept === cat) return true;
  if (Number(ticket.created_by) === Number(user.id)) return true;
  if (ticket.assigned_to != null && Number(ticket.assigned_to) === Number(user.id)) return true;
  return false;
}

function canSeeTaskRow(user, row) {
  if (!user) return false;
  const level = user.permission_level
    || (user.role === 'superadmin' ? 'superadmin'
      : user.role === 'administrator' ? 'administrator'
        : user.role === 'manager' ? 'manager' : 'user');
  if (level === 'superadmin' || level === 'administrator') return true;
  const cat = taskEffectiveDept(row);
  const dept = (user.departamento || '').trim();
  if (cat && dept === cat) return true;
  if (Number(row.assigned_to) === Number(user.id)) return true;
  if (Number(row.created_by) === Number(user.id)) return true;
  return false;
}

function canParticipateOnTask(user, row) {
  return canSeeTaskRow(user, row);
}

function canDeleteTaskAttachment(user, row, attachment) {
  if (!user || !row) return false;
  const level = user.permission_level
    || (user.role === 'superadmin' ? 'superadmin'
      : user.role === 'administrator' ? 'administrator'
        : user.role === 'manager' ? 'manager' : 'user');
  if (level === 'superadmin' || level === 'administrator') return true;
  if (Number(row.assigned_to) === Number(user.id)) return true;
  if (Number(row.created_by) === Number(user.id)) return true;
  if (attachment && Number(attachment.uploaded_by) === Number(user.id)) return true;
  return canManageTaskRow(user, row);
}

function loadTaskRow(db, id) {
  return db.prepare(`
    SELECT tt.*,
      t.title as ticket_title, t.category as ticket_category, t.status as ticket_status,
      t.created_by as ticket_created_by, t.assigned_to as ticket_assigned_to,
      u1.name as assignee_name, u1.apellido as assignee_apellido,
      u1.departamento as assignee_departamento, u1.puesto as assignee_puesto,
      u1.avatar_url as assignee_avatar_url,
      u2.name as creator_name,
      u3.name as completion_requester_name, u3.apellido as completion_requester_apellido
    FROM ticket_tasks tt
    LEFT JOIN tickets t ON tt.ticket_id = t.id
    LEFT JOIN users u1 ON tt.assigned_to = u1.id
    LEFT JOIN users u2 ON tt.created_by = u2.id
    LEFT JOIN users u3 ON tt.completion_requested_by = u3.id
    WHERE tt.id = ?
  `).get(id);
}

function notifyTaskParticipants(db, task, actorId, payload) {
  if (!task) return;
  const ids = new Set(
    [task.assigned_to, task.created_by].filter((x) => x != null).map((x) => Number(x)),
  );
  ids.delete(Number(actorId));
  for (const uid of ids) {
    notifyUser(uid, {
      ...payload,
      module: 'tasks',
      related_id: Number(task.id),
      link_id: task.ticket_id != null ? Number(task.ticket_id) : null,
    });
  }
}

function deleteTaskAttachmentFiles(db, taskId) {
  const rows = db.prepare('SELECT path FROM task_attachments WHERE task_id = ?').all(taskId);
  for (const row of rows) {
    try {
      if (row.path && fs.existsSync(row.path)) fs.unlinkSync(row.path);
    } catch (_) { /* noop */ }
  }
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
        t.created_by as ticket_created_by, t.assigned_to as ticket_assigned_to,
        u1.name as assignee_name, u1.apellido as assignee_apellido,
        u1.departamento as assignee_departamento, u1.puesto as assignee_puesto,
        u1.avatar_url as assignee_avatar_url,
        u2.name as creator_name
      FROM ticket_tasks tt
      LEFT JOIN tickets t ON tt.ticket_id = t.id
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
        tk.created_by as ticket_created_by, tk.assigned_to as ticket_assigned_to,
        u1.name as assignee_name, u1.apellido as assignee_apellido,
        u1.departamento as assignee_departamento, u1.puesto as assignee_puesto,
        u1.avatar_url as assignee_avatar_url,
        u2.name as creator_name
      FROM ticket_tasks tt
      LEFT JOIN tickets tk ON tt.ticket_id = tk.id
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

const createStandaloneTask = (req, res) => {
  try {
    const user_id = req.user?.id;
    if (!user_id) return res.status(401).json({ error: 'No autenticado' });

    const { title, description, assigned_to, start_date, end_date, department } = req.body || {};
    if (!title || !String(title).trim()) return res.status(400).json({ error: 'Título requerido' });
    if (assigned_to == null || assigned_to === '') return res.status(400).json({ error: 'Indica responsable' });
    if (!start_date || !end_date) return res.status(400).json({ error: 'Fechas de inicio y fin requeridas' });

    let dept = '';
    const level = req.user.permission_level
      || (req.user.role === 'superadmin' ? 'superadmin'
        : req.user.role === 'administrator' ? 'administrator'
          : req.user.role === 'manager' ? 'manager' : 'user');
    if (level === 'superadmin' || level === 'administrator') {
      dept = String(department || '').trim();
      if (!dept) return res.status(400).json({ error: 'Indica departamento' });
    } else if (level === 'manager') {
      dept = (req.user.departamento || '').trim();
      if (!dept) {
        return res.status(403).json({ error: 'Tu perfil no tiene departamento asignado para crear tareas.' });
      }
    } else {
      return res.status(403).json({
        error: 'Solo un gerente de departamento o un administrador puede crear tareas operativas.',
      });
    }

    const db = getDb();
    const assigneeCheck = validateAssigneeInDept(db, assigned_to, dept);
    if (assigneeCheck.error) return res.status(400).json({ error: assigneeCheck.error });
    const { assignee } = assigneeCheck;

    const s = String(start_date).slice(0, 10);
    const e = String(end_date).slice(0, 10);
    if (s > e) return res.status(400).json({ error: 'La fecha de fin debe ser igual o posterior al inicio' });

    const dup = findRecentDuplicateTask(db, {
      created_by: user_id,
      assigned_to: assignee.id,
      start_date: s,
      end_date: e,
      title: String(title).trim(),
      department: dept,
    });
    if (dup) {
      const full = loadTaskRow(db, dup.id);
      return res.status(200).json({ ...(full || dup), duplicate: true });
    }

    const info = db.prepare(`
      INSERT INTO ticket_tasks (ticket_id, department, title, description, assigned_to, created_by, start_date, end_date, status)
      VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      dept,
      String(title).trim(),
      description ? String(description).trim() : '',
      assignee.id,
      user_id,
      s,
      e
    );

    const taskId = info.lastInsertRowid;
    const taskTitle = String(title).trim();
    try {
      notifyAndEmailTaskAssignee(db, assignee.id, user_id, {
        taskTitle,
        ticket: null,
        department: dept,
        startDate: s,
        endDate: e,
        taskId,
      });
    } catch (_) { /* noop */ }

    const row = db.prepare(`
      SELECT tt.*,
        u1.name as assignee_name, u1.apellido as assignee_apellido,
        u1.departamento as assignee_departamento, u1.puesto as assignee_puesto,
        u1.avatar_url as assignee_avatar_url,
        u2.name as creator_name
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
    if (!canAssignTicketTramo(req.user, ticket)) {
      return res.status(403).json({
        error: 'Solo el coordinador asignado a este ticket puede asignar tramos de trabajo.',
      });
    }

    const assigneeCheck = validateAssigneeInDept(db, assigned_to, ticket.category);
    if (assigneeCheck.error) return res.status(400).json({ error: assigneeCheck.error });
    const { assignee } = assigneeCheck;

    const s = String(start_date).slice(0, 10);
    const e = String(end_date).slice(0, 10);
    if (s > e) return res.status(400).json({ error: 'La fecha de fin debe ser igual o posterior al inicio' });

    const existingAssignee = findAssigneeTaskOnTicket(db, ticketId, assignee.id);
    if (existingAssignee) {
      return res.status(409).json({
        error: 'Ese usuario ya tiene una tarea asignada en este ticket.',
        existing_task_id: existingAssignee.id,
      });
    }

    const dup = findRecentDuplicateTask(db, {
      created_by: user_id,
      assigned_to: assignee.id,
      start_date: s,
      end_date: e,
      title: String(title).trim(),
      ticket_id: ticketId,
      department: ticket.category,
    });
    if (dup) {
      const full = loadTaskRow(db, dup.id);
      return res.status(200).json({ ...(full || dup), duplicate: true });
    }

    const info = db.prepare(`
      INSERT INTO ticket_tasks (ticket_id, department, title, description, assigned_to, created_by, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      ticketId,
      (ticket.category || '').trim(),
      String(title).trim(),
      description ? String(description).trim() : '',
      assignee.id,
      user_id,
      s,
      e
    );

    const taskId = info.lastInsertRowid;
    const taskTitle = String(title).trim();
    try {
      notifyAndEmailTaskAssignee(db, assignee.id, user_id, {
        taskTitle,
        ticket,
        department: ticket.category,
        startDate: s,
        endDate: e,
        taskId,
      });
      const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(user_id);
      notifyTicketStakeholders(
        db,
        ticketId,
        user_id,
        {
          type: 'task',
          title: 'Nueva tarea operativa',
          message: `${actor?.name || 'Alguien'} creó la tarea "${taskTitle}" en "${ticket.title}".`,
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
    const ctx = getTaskContext(db, task);
    const { ticket, department } = ctx;
    if (ctx.linkedToTicket && !ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

    const canOwn = canUpdateTaskFields(req.user, task, ticket, req.body || {});
    if (!canOwn) {
      return res.status(403).json({ error: 'Sin permiso para modificar esta tarea.' });
    }

    const patch = req.body || {};
    const isCreator = isTaskOrTicketCreator(req.user, task, ticket);
    if (!isCreator) {
      const nonStatus = Object.keys(patch).filter(
        (k) => ['title', 'description', 'assigned_to', 'start_date', 'end_date'].includes(k),
      );
      if (nonStatus.length > 0) {
        return res.status(403).json({ error: 'Como coordinador solo puedes cambiar el estatus de la tarea.' });
      }
    }

    const prevAssigneeId = Number(task.assigned_to);
    const allowed = ['title', 'description', 'assigned_to', 'start_date', 'end_date', 'status'];
    const updates = [];
    const values = [];
    for (const k of allowed) {
      if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
      if (k === 'assigned_to') {
        if (!isTaskOrTicketCreator(req.user, task, ticket)) {
          return res.status(403).json({ error: 'Solo quien creó el ticket o la tarea puede reasignarla.' });
        }
        const assigneeCheck = validateAssigneeInDept(db, patch[k], department);
        if (assigneeCheck.error) return res.status(400).json({ error: assigneeCheck.error });
        if (ctx.linkedToTicket && task.ticket_id) {
          const existingAssignee = findAssigneeTaskOnTicket(db, task.ticket_id, patch[k], id);
          if (existingAssignee) {
            return res.status(409).json({
              error: 'Ese usuario ya tiene una tarea asignada en este ticket.',
              existing_task_id: existingAssignee.id,
            });
          }
        }
      }
      if (k === 'status') {
        const st = patch.status;
        if (!['pending', 'in_progress', 'done', 'cancelled'].includes(st)) {
          return res.status(400).json({ error: 'Estado no válido' });
        }
      }
      updates.push(`${k} = ?`);
      values.push(patch[k]);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
    if (Object.prototype.hasOwnProperty.call(patch, 'status') && patch.status === 'done') {
      updates.push('completion_requested_at = NULL', 'completion_requested_by = NULL');
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'start_date') || Object.prototype.hasOwnProperty.call(patch, 'end_date')) {
      const cur = db.prepare('SELECT start_date, end_date FROM ticket_tasks WHERE id = ?').get(id);
      const ns = Object.prototype.hasOwnProperty.call(patch, 'start_date') ? String(patch.start_date).slice(0, 10) : cur.start_date;
      const ne = Object.prototype.hasOwnProperty.call(patch, 'end_date') ? String(patch.end_date).slice(0, 10) : cur.end_date;
      if (ns > ne) return res.status(400).json({ error: 'La fecha de fin debe ser igual o posterior al inicio' });
    }
    values.push(id);
    db.prepare(`UPDATE ticket_tasks SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);

    const row = db.prepare(`
      SELECT tt.*, t.title as ticket_title, t.category as ticket_category, t.status as ticket_status,
        t.created_by as ticket_created_by,
        u1.name as assignee_name, u1.apellido as assignee_apellido, u2.name as creator_name
      FROM ticket_tasks tt
      LEFT JOIN tickets t ON tt.ticket_id = t.id
      LEFT JOIN users u1 ON tt.assigned_to = u1.id
      LEFT JOIN users u2 ON tt.created_by = u2.id
      WHERE tt.id = ?
    `).get(id);

    try {
      if (
        Object.prototype.hasOwnProperty.call(patch, 'status') &&
        patch.status === 'done' &&
        task.assigned_to &&
        Number(task.assigned_to) !== Number(user_id)
      ) {
        notifyUser(Number(task.assigned_to), {
          type: 'task',
          title: 'Tarea aprobada',
          message: `El coordinador confirmó que la tarea "${row?.title || task.title}" está hecha.`,
          module: 'tasks',
          related_id: Number(id),
          link_id: task.ticket_id != null ? Number(task.ticket_id) : Number(id),
        });
      }
      if (
        Object.prototype.hasOwnProperty.call(patch, 'assigned_to') &&
        Number(patch.assigned_to) !== prevAssigneeId
      ) {
        notifyAndEmailTaskAssignee(db, Number(patch.assigned_to), user_id, {
          taskTitle: row?.title || task.title,
          ticket,
          department,
          startDate: row?.start_date || task.start_date,
          endDate: row?.end_date || task.end_date,
          taskId: id,
        });
      }
      if (ctx.linkedToTicket && task.ticket_id) {
        const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(user_id);
        notifyTicketStakeholders(db, task.ticket_id, user_id, {
          type: 'task',
          title: 'Tarea operativa actualizada',
          message: `${actor?.name || 'Alguien'} actualizó "${row?.title || task.title}" (${row?.ticket_title || ticket?.title || ''}).`,
          module: 'tasks',
          related_id: Number(task.ticket_id),
          link_id: Number(task.ticket_id),
        }, Object.prototype.hasOwnProperty.call(patch, 'assigned_to') && Number(patch.assigned_to) !== prevAssigneeId
          ? [Number(patch.assigned_to)]
          : []);
      }
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
    const ctx = getTaskContext(db, task);
    const { ticket } = ctx;
    if (!isTaskOrTicketCreator(req.user, task, ticket)) {
      return res.status(403).json({ error: 'Solo quien creó el ticket o la tarea puede eliminarla.' });
    }
    try {
      if (ctx.linkedToTicket && task.ticket_id) {
        const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(user_id);
        notifyTicketStakeholders(db, task.ticket_id, user_id, {
          type: 'task',
          title: 'Tarea operativa eliminada',
          message: `${actor?.name || 'Alguien'} eliminó la tarea "${task.title}" del ticket.`,
          module: 'tasks',
          related_id: Number(task.ticket_id),
          link_id: Number(task.ticket_id),
        });
      }
    } catch (_) { /* noop */ }

    deleteTaskAttachmentFiles(db, id);
    db.prepare('DELETE FROM ticket_tasks WHERE id = ?').run(id);
    res.json({ message: 'Tarea eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar tarea' });
  }
};

const getTaskDetail = (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const task = loadTaskRow(db, id);
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (!canSeeTaskRow(req.user, task)) {
      return res.status(403).json({ error: 'Sin permiso para ver esta tarea' });
    }
    const comments = db.prepare(`
      SELECT c.*, u.name as user_name, u.apellido as user_apellido, u.avatar_url as user_avatar_url
      FROM task_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.task_id = ?
      ORDER BY c.created_at ASC
    `).all(id);
    const attachments = db.prepare(`
      SELECT a.*, u.name as uploader_name
      FROM task_attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.task_id = ?
      ORDER BY a.created_at DESC
    `).all(id).map((att) => ({
      ...att,
      can_delete: canDeleteTaskAttachment(req.user, task, att),
    }));
    res.json({ ...task, comments, attachments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar tarea' });
  }
};

const addTaskComment = (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const user_id = req.user?.id;
    if (!user_id) return res.status(401).json({ error: 'No autenticado' });
    if (!content || !String(content).trim()) return res.status(400).json({ error: 'Contenido vacío' });

    const db = getDb();
    const task = loadTaskRow(db, id);
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (!canParticipateOnTask(req.user, task)) {
      return res.status(403).json({ error: 'Sin permiso para comentar en esta tarea' });
    }

    db.prepare('INSERT INTO task_comments (task_id, user_id, content) VALUES (?, ?, ?)')
      .run(id, user_id, String(content).trim());

    try {
      const author = db.prepare('SELECT name FROM users WHERE id = ?').get(user_id);
      notifyTaskParticipants(db, task, user_id, {
        type: 'task',
        title: 'Comentario en tarea',
        message: `${author?.name || 'Alguien'} comentó en "${task.title}".`,
      });
    } catch (_) { /* noop */ }

    res.status(201).json({ message: 'Comentario añadido' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al añadir comentario' });
  }
};

const uploadTaskAttachment = (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user?.id;
    if (!user_id) return res.status(401).json({ error: 'No autenticado' });
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No se subió ningún archivo' });

    const db = getDb();
    const task = loadTaskRow(db, id);
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (!canParticipateOnTask(req.user, task)) {
      return res.status(403).json({ error: 'Sin permiso para subir archivos en esta tarea' });
    }

    db.prepare(`
      INSERT INTO task_attachments (task_id, filename, mimetype, path, uploaded_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, file.originalname, file.mimetype, file.path, user_id);

    try {
      const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(user_id);
      notifyTaskParticipants(db, task, user_id, {
        type: 'task',
        title: 'Archivo en tarea',
        message: `${actor?.name || 'Alguien'} subió "${file.originalname}" en "${task.title}".`,
      });
    } catch (_) { /* noop */ }

    res.status(201).json({ message: 'Archivo subido correctamente', file: file.originalname });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al subir archivo' });
  }
};

const requestTaskCompletion = (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user?.id;
    if (!user_id) return res.status(401).json({ error: 'No autenticado' });

    const db = getDb();
    const task = loadTaskRow(db, id);
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (!canSeeTaskRow(req.user, task)) {
      return res.status(403).json({ error: 'Sin permiso para ver esta tarea' });
    }
    if (Number(task.assigned_to) !== Number(user_id)) {
      return res.status(403).json({ error: 'Solo el responsable asignado puede reportar que terminó el trabajo.' });
    }
    if (task.status === 'done' || task.status === 'cancelled') {
      return res.status(400).json({ error: 'Esta tarea ya está cerrada.' });
    }
    if (task.completion_requested_at) {
      const full = loadTaskRow(db, id);
      return res.json({
        ...(full || task),
        message: 'Ya enviaste esta tarea a revisión del coordinador.',
        already_requested: true,
      });
    }

    db.prepare(`
      UPDATE ticket_tasks
      SET completion_requested_at = datetime('now'),
          completion_requested_by = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(user_id, id);

    const ctx = getTaskContext(db, task);
    try {
      notifyTaskCompletionRequest(db, task, ctx.ticket, user_id);
    } catch (_) { /* noop */ }

    const row = loadTaskRow(db, id);
    res.json({
      ...(row || task),
      message: 'Trabajo enviado a revisión del coordinador.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al solicitar revisión' });
  }
};

const deleteTaskAttachment = (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    const user_id = req.user?.id;
    if (!user_id) return res.status(401).json({ error: 'No autenticado' });

    const db = getDb();
    const task = loadTaskRow(db, id);
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });

    const att = db.prepare('SELECT * FROM task_attachments WHERE id = ? AND task_id = ?').get(attachmentId, id);
    if (!att) return res.status(404).json({ error: 'Archivo no encontrado' });
    if (!canDeleteTaskAttachment(req.user, task, att)) {
      return res.status(403).json({ error: 'Sin permiso para eliminar este archivo' });
    }

    try {
      if (att.path && fs.existsSync(att.path)) fs.unlinkSync(att.path);
    } catch (_) { /* noop */ }

    db.prepare('DELETE FROM task_attachments WHERE id = ?').run(attachmentId);
    res.json({ message: 'Archivo eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar archivo' });
  }
};

module.exports = {
  listTasks,
  listTasksByTicket,
  createStandaloneTask,
  createTask,
  updateTask,
  deleteTask,
  getTaskDetail,
  addTaskComment,
  requestTaskCompletion,
  uploadTaskAttachment,
  deleteTaskAttachment,
};
