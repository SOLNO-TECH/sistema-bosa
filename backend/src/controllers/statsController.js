const { getDb } = require('../database/init');

const getPerformanceStats = (req, res) => {
  try {
    const db = getDb();
    
    // 1. Tasa de Resolución Real
    const totalTickets = db.prepare('SELECT COUNT(*) as count FROM tickets').get().count;
    const closedTickets = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status IN ('resolved', 'closed')").get().count;
    const resolutionRate = totalTickets > 0 ? Math.round((closedTickets / totalTickets) * 100) : 0;

    // 2. Eficiencia (Basada en tiempo promedio o volumen)
    // Por ahora volumen de actividad en historial vs total
    const totalActions = db.prepare('SELECT COUNT(*) as count FROM ticket_history').get().count;
    const efficiency = totalTickets > 0 ? Math.min(100, Math.round((totalActions / (totalTickets * 2)) * 100)) : 0;

    // 3. Top Colaboradores Reales
    const topUsers = db.prepare(`
      SELECT 
        u.name, 
        u.apellido, 
        u.departamento as dept,
        (SELECT COUNT(*) FROM tickets t WHERE t.assigned_to = u.id AND t.status IN ('resolved', 'closed')) as solved,
        (SELECT COUNT(*) FROM ticket_comments c WHERE c.user_id = u.id) as comments
      FROM users u
      WHERE u.is_active = 1
      ORDER BY solved DESC, comments DESC
      LIMIT 5
    `).all();

    // Calcular un score dinámico para el ranking
    const processedTopUsers = topUsers.map(u => ({
      name: `${u.name} ${u.apellido?.charAt(0) || ''}.`,
      dept: u.dept || 'General',
      score: (u.solved * 10) + (u.comments * 2) + 50 // Base de 50 + puntos por logros
    }));

    res.json({
      resolutionRate,
      efficiency: efficiency || 85, // Fallback si no hay historial aún
      topUsers: processedTopUsers,
      totalUsers: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
      engagement: totalActions > 0 ? 'Alto' : 'Iniciando'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular estadísticas' });
  }
};

module.exports = {
  getPerformanceStats
};
