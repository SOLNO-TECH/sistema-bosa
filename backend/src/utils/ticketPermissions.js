/**
 * Permisos para asignar responsable del ticket y crear/editar tareas operativas
 * del mismo departamento que el ticket (category).
 */
function canManageDeptTicketAssignments(reqUser, ticket) {
  if (!reqUser || !ticket) return false;
  const level = reqUser.permission_level
    || (reqUser.role === 'superadmin' ? 'superadmin'
      : reqUser.role === 'administrator' ? 'administrator'
        : reqUser.role === 'manager' ? 'manager' : 'user');
  if (level === 'superadmin' || level === 'administrator') return true;
  if (level !== 'manager') return false;
  const cat = (ticket.category || '').trim();
  const dept = (reqUser.departamento || '').trim();
  return Boolean(cat && dept === cat);
}

/** Solo el coordinador del ticket (assigned_to) puede asignar tramos a su equipo. */
function canAssignTicketTramo(reqUser, ticket) {
  if (!reqUser || !ticket) return false;
  if (ticket.assigned_to == null || ticket.assigned_to === '') return false;
  return Number(ticket.assigned_to) === Number(reqUser.id);
}

module.exports = {
  canManageDeptTicketAssignments,
  canAssignTicketTramo,
};
