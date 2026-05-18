/**
 * Permisos para asignar responsable del ticket y crear/editar tareas operativas
 * del mismo departamento que el ticket (category).
 */
function canManageDeptTicketAssignments(reqUser, ticket) {
  if (!reqUser || !ticket) return false;
  if (reqUser.role === 'superadmin' || reqUser.role === 'administrator') return true;
  if (reqUser.role !== 'manager') return false;
  const cat = (ticket.category || '').trim();
  const dept = (reqUser.departamento || '').trim();
  return Boolean(cat && dept === cat);
}

module.exports = {
  canManageDeptTicketAssignments,
};
