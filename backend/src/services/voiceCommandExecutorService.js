const { getDb } = require('../database/init');
const { findSalaConflict, findAttendeeConflicts, normalizeLocationType } = require('../utils/meetingSchedule');
const { canManageDeptTicketAssignments } = require('../utils/ticketPermissions');
const { executeVoiceQuery } = require('./voice/voiceQueryService');
const { localDateYMD } = require('../utils/localDate');

function permissionLevel(user) {
  return (
    user.permission_level ||
    (user.role === 'superadmin'
      ? 'superadmin'
      : user.role === 'administrator'
        ? 'administrator'
        : user.role === 'manager'
          ? 'manager'
          : 'user')
  );
}

function canCreateAviso(user) {
  const level = permissionLevel(user);
  return level === 'superadmin' || level === 'administrator' || level === 'manager';
}

function canCreateTask(user) {
  const level = permissionLevel(user);
  return level === 'superadmin' || level === 'administrator' || level === 'manager';
}

/**
 * Ejecuta un comando ya confirmado por el usuario.
 */
function executeVoiceCommand(intent, params, user) {
  const db = getDb();

  switch (intent) {
    case 'create_ticket': {
      if (!params?.title) throw new Error('Falta el título del ticket.');
      const info = db
        .prepare(
          `INSERT INTO tickets (title, description, priority, category, assigned_to, created_by, due_date)
           VALUES (?, ?, ?, ?, NULL, ?, NULL)`,
        )
        .run(
          String(params.title).trim(),
          params.description || '',
          params.priority || 'medium',
          params.category || '',
          user.id,
        );
      return {
        success: true,
        message: `Ticket #${info.lastInsertRowid} creado.`,
        module: 'tickets',
        related_id: Number(info.lastInsertRowid),
        data: { ticket_id: info.lastInsertRowid },
      };
    }

    case 'update_ticket_status': {
      const ticketId = Number(params.ticket_id);
      const status = params.status;
      if (!ticketId || !status) throw new Error('Ticket o estado inválido.');
      const ticket = db.prepare('SELECT id, status, title FROM tickets WHERE id = ?').get(ticketId);
      if (!ticket) throw new Error(`Ticket #${ticketId} no encontrado.`);
      db.prepare(`UPDATE tickets SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, ticketId);
      return {
        success: true,
        message: `Ticket #${ticketId} actualizado a "${status}".`,
        module: 'tickets',
        related_id: ticketId,
        data: { ticket_id: ticketId, status },
      };
    }

    case 'create_task': {
      if (!canCreateTask(user)) {
        throw new Error('No tienes permiso para crear tareas operativas.');
      }
      if (!params?.title) throw new Error('Falta el título de la tarea.');
      if (!params?.assigned_to) {
        throw new Error('Indica un responsable válido (di "asignar a Nombre Apellido").');
      }
      let dept = String(params.department || '').trim();
      const level = permissionLevel(user);
      if (level === 'manager') {
        dept = (user.departamento || '').trim();
      } else if (!dept && level !== 'manager') {
        dept = String(params.department || user.departamento || '').trim();
      }
      const assignee = db
        .prepare('SELECT id, departamento, is_active FROM users WHERE id = ?')
        .get(Number(params.assigned_to));
      if (!assignee?.is_active) throw new Error('Responsable no válido.');
      if (!dept) dept = (assignee.departamento || '').trim();
      if (!dept) throw new Error('Indica departamento para la tarea.');
      if ((assignee.departamento || '').trim() !== dept) {
        throw new Error('El responsable no pertenece al departamento indicado.');
      }

      const start = String(params.start_date || localDateYMD()).slice(0, 10);
      const end = String(params.end_date || start).slice(0, 10);

      const info = db
        .prepare(
          `INSERT INTO ticket_tasks (ticket_id, department, title, description, assigned_to, created_by, start_date, end_date, status)
           VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        )
        .run(dept, String(params.title).trim(), params.description || '', assignee.id, user.id, start, end);

      return {
        success: true,
        message: `Tarea #${info.lastInsertRowid} creada.`,
        module: 'tasks',
        related_id: Number(info.lastInsertRowid),
        data: { task_id: info.lastInsertRowid },
      };
    }

    case 'query_meetings':
    case 'query_tickets':
    case 'query_tasks':
    case 'query_avisos':
    case 'query_minutas':
    case 'query_notifications':
      return executeVoiceQuery(intent, params, user);

    case 'create_meeting': {
      const title = String(params.title || '').trim();
      const date = params.date;
      const start = params.start_time;
      const end = params.end_time;
      if (!title || !date || !start || !end) {
        throw new Error('Faltan datos de la reunión. Indica título, fecha y hora.');
      }

      const location_type = normalizeLocationType(params.location_type);
      let attendees = Array.isArray(params.attendees) ? params.attendees.map(Number).filter(Boolean) : [];

      if (Array.isArray(params.departments) && params.departments.length) {
        const activeUsers = db
          .prepare(`SELECT id, departamento FROM users WHERE is_active = 1`)
          .all();
        for (const u of activeUsers) {
          const ud = String(u.departamento || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
          if (!ud) continue;
          const inDept = params.departments.some((d) => {
            const dd = String(d || '')
              .toLowerCase()
              .normalize('NFD')
              .replace(/\p{M}/gu, '');
            return ud === dd || ud.includes(dd) || dd.includes(ud);
          });
          if (inDept) attendees.push(u.id);
        }
      }
      attendees = [...new Set(attendees.filter(Boolean))];

      const { generateMeetingOccurrences } = require('./voice/voiceCreateMeeting');
      const occurrences = generateMeetingOccurrences({ ...params, date, start_time: start, end_time: end });
      if (!occurrences.length) {
        throw new Error('No se pudo calcular el horario de la reunión.');
      }

      let firstId = null;
      for (const occ of occurrences) {
        const start_time = `${occ.date}T${occ.start_time}:00`;
        const end_time = `${occ.date}T${occ.end_time}:00`;

        if (location_type === 'sala_juntas') {
          const check = findSalaConflict(db, start_time, end_time);
          if (check?.conflict) {
            throw new Error(`La sala de juntas ya está ocupada el ${occ.date} ${occ.start_time}–${occ.end_time}.`);
          }
          if (check?.invalidRange) throw new Error('La hora de fin debe ser posterior al inicio.');
        }

        const attendeeCheck = findAttendeeConflicts(db, start_time, end_time, attendees, null, user.id);
        if (attendeeCheck?.conflicts?.length) {
          const busy = attendeeCheck.conflicts[0];
          const busyUser = db.prepare('SELECT name, apellido FROM users WHERE id = ?').get(busy.userId);
          const busyName = busyUser
            ? [busyUser.name, busyUser.apellido].filter(Boolean).join(' ').trim()
            : `Usuario #${busy.userId}`;
          throw new Error(`${busyName} ya tiene otra reunión el ${occ.date} ${occ.start_time}–${occ.end_time}.`);
        }

        const info = db
          .prepare(
            `INSERT INTO meetings (title, description, start_time, end_time, created_by, attendees, location_type)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            title,
            params.description || '',
            start_time,
            end_time,
            user.id,
            JSON.stringify(attendees),
            location_type,
          );
        if (!firstId) firstId = info.lastInsertRowid;
      }

      const count = occurrences.length;
      return {
        success: true,
        message:
          count > 1
            ? `${count} reuniones "${title}" agendadas (recurrencia ${params.recurrence}).`
            : `Reunión #${firstId} agendada.`,
        module: 'calendar',
        related_id: Number(firstId),
        data: { meeting_id: firstId, occurrences: count },
      };
    }

    case 'create_aviso': {
      if (!canCreateAviso(user)) {
        throw new Error('No tienes permiso para publicar avisos.');
      }
      const title = String(params.title || '').trim();
      const content = String(params.content || params.title || '').trim();
      if (!title || !content) throw new Error('Faltan título o contenido del aviso.');

      const info = db
        .prepare(`INSERT INTO avisos (title, content, category, created_by) VALUES (?, ?, ?, ?)`)
        .run(title, content, params.category || 'general', user.id);

      return {
        success: true,
        message: `Aviso #${info.lastInsertRowid} publicado.`,
        module: 'avisos',
        related_id: Number(info.lastInsertRowid),
        data: { aviso_id: info.lastInsertRowid },
      };
    }

    case 'update_ticket': {
      const ticketId = Number(params.ticket_id);
      if (!ticketId) throw new Error('Ticket inválido.');
      const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticketId);
      if (!ticket) throw new Error(`Ticket #${ticketId} no encontrado.`);
      const allowed = ['title', 'description', 'priority', 'category'];
      const updates = [];
      const values = [];
      for (const key of allowed) {
        if (params[key] === undefined || params[key] === null) continue;
        updates.push(`${key} = ?`);
        values.push(params[key]);
      }
      if (updates.length === 0) throw new Error('Nada que actualizar en el ticket.');
      values.push(ticketId);
      db.prepare(`UPDATE tickets SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
      return {
        success: true,
        message: `Ticket #${ticketId} actualizado.`,
        module: 'tickets',
        related_id: ticketId,
      };
    }

    case 'assign_ticket': {
      const ticketId = Number(params.ticket_id);
      const assignedTo = Number(params.assigned_to);
      if (!ticketId || !assignedTo) throw new Error('Ticket o responsable inválido.');
      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
      if (!ticket) throw new Error(`Ticket #${ticketId} no encontrado.`);
      if (!canManageDeptTicketAssignments(user, ticket)) {
        throw new Error('No tienes permiso para asignar este ticket.');
      }
      const assignee = db.prepare('SELECT id, departamento, is_active FROM users WHERE id = ?').get(assignedTo);
      if (!assignee?.is_active) throw new Error('Responsable no válido.');
      if ((assignee.departamento || '').trim() !== (ticket.category || '').trim()) {
        throw new Error('El responsable debe ser del departamento del ticket.');
      }
      db.prepare(`UPDATE tickets SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?`).run(assignedTo, ticketId);
      return {
        success: true,
        message: `Ticket #${ticketId} asignado.`,
        module: 'tickets',
        related_id: ticketId,
      };
    }

    case 'update_task': {
      const taskId = Number(params.task_id);
      if (!taskId) throw new Error('Tarea inválida.');
      const task = db.prepare('SELECT * FROM ticket_tasks WHERE id = ?').get(taskId);
      if (!task) throw new Error(`Tarea #${taskId} no encontrada.`);
      if (!canCreateTask(user) && Number(task.assigned_to) !== Number(user.id)) {
        throw new Error('No tienes permiso para editar esta tarea.');
      }
      if (params.title) {
        db.prepare(`UPDATE ticket_tasks SET title = ?, updated_at = datetime('now') WHERE id = ?`).run(
          String(params.title).trim(),
          taskId,
        );
      } else {
        throw new Error('Indica qué campo editar de la tarea.');
      }
      return {
        success: true,
        message: `Tarea #${taskId} actualizada.`,
        module: 'tasks',
        related_id: taskId,
      };
    }

    case 'update_task_status': {
      const taskId = Number(params.task_id);
      const status = params.status;
      if (!taskId || !status) throw new Error('Tarea o estado inválido.');
      const task = db.prepare('SELECT * FROM ticket_tasks WHERE id = ?').get(taskId);
      if (!task) throw new Error(`Tarea #${taskId} no encontrada.`);
      const allowed = ['pending', 'in_progress', 'done', 'cancelled'];
      if (!allowed.includes(status)) throw new Error('Estado no válido.');
      db.prepare(`UPDATE ticket_tasks SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, taskId);
      return {
        success: true,
        message: `Tarea #${taskId} en estado "${status}".`,
        module: 'tasks',
        related_id: taskId,
      };
    }

    case 'update_meeting': {
      const meetingId = Number(params.meeting_id);
      if (!meetingId) throw new Error('Indica el número de reunión.');
      const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId);
      if (!meeting) throw new Error(`Reunión #${meetingId} no encontrada.`);
      const date = params.date;
      const start = params.start_time || '10:00';
      const end = params.end_time || '11:00';
      const start_time = `${date}T${start}:00`;
      const end_time = `${date}T${end}:00`;
      if (meeting.location_type === 'sala_juntas') {
        const check = findSalaConflict(db, start_time, end_time, meetingId);
        if (check?.conflict) throw new Error('La sala de juntas ya está ocupada en ese horario.');
      }
      const attendeeIds = JSON.parse(meeting.attendees || '[]').map(Number).filter(Boolean);
      const attendeeCheck = findAttendeeConflicts(
        db,
        start_time,
        end_time,
        attendeeIds,
        meetingId,
        meeting.created_by,
      );
      if (attendeeCheck?.conflicts?.length) {
        throw new Error('Algún participante ya tiene otra reunión en ese horario.');
      }
      db.prepare(
        `UPDATE meetings SET start_time = ?, end_time = ?, updated_at = datetime('now') WHERE id = ?`,
      ).run(start_time, end_time, meetingId);
      return {
        success: true,
        message: `Reunión #${meetingId} reagendada.`,
        module: 'calendar',
        related_id: meetingId,
      };
    }

    case 'append_minute_note': {
      const minuteId = Number(params.minute_id);
      const note = String(params.note || '').trim();
      if (!minuteId || !note) throw new Error('Minuta o nota inválida.');
      const row = db.prepare('SELECT * FROM meeting_minutes WHERE id = ?').get(minuteId);
      if (!row) throw new Error(`Minuta #${minuteId} no encontrada.`);
      let topics = [];
      try {
        topics = JSON.parse(row.topics_json || '[]');
      } catch {
        topics = [];
      }
      if (!topics.length) {
        topics = [{ titulo: 'Acuerdos', descripcion: '', comentarios: '' }];
      }
      const idx = topics.findIndex((t) => /acuerdo/i.test(t.titulo || ''));
      const target = idx >= 0 ? idx : 0;
      const prev = topics[target].descripcion || '';
      topics[target] = {
        ...topics[target],
        descripcion: prev ? `${prev}\n\n[Saya AI] ${note}` : `[Saya AI] ${note}`,
      };
      db.prepare(
        `UPDATE meeting_minutes SET topics_json = ?, updated_at = datetime('now') WHERE id = ?`,
      ).run(JSON.stringify(topics), minuteId);
      return {
        success: true,
        message: `Nota agregada a minuta #${minuteId}.`,
        module: 'minutas',
        related_id: minuteId,
      };
    }

    case 'open_minute':
    case 'navigate':
    case 'help':
      return {
        success: true,
        message: 'Acción de interfaz.',
        clientOnly: true,
        module: intent === 'open_minute' ? 'minutas' : params?.module,
        related_id: intent === 'open_minute' ? Number(params.minute_id) : undefined,
        data: params,
      };

    default:
      throw new Error('Comando no ejecutable.');
  }
}

module.exports = {
  executeVoiceCommand,
  canCreateAviso,
  canCreateTask,
};
