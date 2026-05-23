const getWelcomeEmailTemplate = (name, email, password, role) => {
  const roleName =
    role === 'superadmin'
      ? 'Super Administrador'
      : role === 'manager'
        ? 'Gerente de departamento'
        : 'Administrador';
  
  return `
<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <style>
    body {
      font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background-color: #f0f2f5;
      margin: 0;
      padding: 0;
    }
    .wrapper {
      padding: 40px 20px;
    }
    .container {
      max-width: 640px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0,0,0,0.05);
    }
    .header {
      background-color: #0A1930;
      padding: 30px;
      text-align: center;
      position: relative;
    }
    .header::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #A47D3B 0%, #E3C587 50%, #A47D3B 100%);
    }
    .content {
      padding: 50px 40px;
      color: #475569;
      line-height: 1.8;
      text-align: center;
    }
    .title {
      font-size: 26px;
      font-weight: 300;
      color: #0A1930;
      margin-top: 0;
      margin-bottom: 24px;
      letter-spacing: 0.5px;
    }
    .highlight-text {
      font-size: 16px;
      margin-bottom: 30px;
    }
    .role-badge {
      display: inline-block;
      background-color: rgba(197, 160, 89, 0.1);
      color: #A47D3B;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 30px;
      border: 1px solid rgba(197, 160, 89, 0.3);
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #C5A059 0%, #A47D3B 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 16px 36px;
      border-radius: 4px;
      font-weight: bold;
      margin-top: 20px;
      text-transform: uppercase;
      font-size: 14px;
      letter-spacing: 1.5px;
      box-shadow: 0 4px 15px rgba(197, 160, 89, 0.3);
    }
    .footer {
      background-color: #f8fafc;
      padding: 30px 40px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
    
    /* Bloqueo forzado de Dark Mode (Para que siempre se vea blanco/claro) */
    @media (prefers-color-scheme: dark) {
      body, .wrapper {
        background-color: #f0f2f5 !important;
      }
      .container {
        background-color: #ffffff !important;
      }
      .content {
        color: #475569 !important;
      }
      .title {
        color: #0A1930 !important;
      }
      .footer {
        background-color: #f8fafc !important;
        border-top: 1px solid #e2e8f0 !important;
        color: #94a3b8 !important;
      }
      .header {
        background-color: #0A1930 !important;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <img src="cid:bosa_logo" alt="BOSA Logo" style="width: 250px; height: auto; display: inline-block; margin: 0 auto;" />
      </div>
      <div class="content">
        <h2 class="title">Una Nueva Experiencia Comienza</h2>
        
        <p class="highlight-text">
          Nos complace darte la bienvenida oficial al sistema operativo central de <strong>BOSA</strong>, <strong>${name}</strong>.
        </p>
        
        <div class="role-badge">
          Perfil asignado: ${roleName}
        </div>
        
        <p style="margin-bottom: 40px; font-size: 15px;">
          Tu cuenta ha sido configurada y está lista para ser utilizada. Ya puedes iniciar sesión para acceder a las herramientas y módulos exclusivos de la plataforma.
        </p>
        
        <div>
          <a href="https://bosahub.bosa.mx/login" class="btn">Acceder al Portal</a>
        </div>
      </div>
      <div class="footer">
        <p>Este es un correo automático generado por BOSA HUB. Por favor no respondas a esta dirección.</p>
        <p>&copy; ${new Date().getFullYear()} BOSA. Todos los derechos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

const getTicketEmailTemplate = (name, ticket) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; color: #333; line-height: 1.6; }
    .header { background: #0A1930; padding: 20px; text-align: center; }
    .content { padding: 30px; border: 1px solid #eee; border-radius: 8px; margin-top: 20px; }
    .title { color: #A47D3B; font-size: 20px; font-weight: bold; }
    .footer { font-size: 12px; color: #999; margin-top: 30px; text-align: center; }
    .badge { background: #A47D3B; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <img src="cid:bosa_logo" width="180" />
  </div>
  <div class="content">
    <h2 class="title">Nuevo Ticket Asignado</h2>
    <p>Hola <strong>${name}</strong>,</p>
    <p>Se te ha asignado un nuevo ticket de soporte en el sistema:</p>
    <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #A47D3B;">
      <p><strong>Asunto:</strong> ${ticket.title}</p>
      <p><strong>Prioridad:</strong> <span class="badge">${ticket.priority.toUpperCase()}</span></p>
      <p><strong>Descripción:</strong> ${ticket.description}</p>
    </div>
    <p style="margin-top: 20px;">Por favor, revisa el dashboard para más detalles y actualización del estado.</p>
  </div>
  <div class="footer">
    &copy; ${new Date().getFullYear()} BOSA. Sistema Operativo Central.
  </div>
</body>
</html>
  `;
};

const getAvisoEmailTemplate = (name, aviso) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; color: #333; }
    .header { background: #0A1930; padding: 20px; text-align: center; }
    .content { padding: 30px; }
    .title { color: #A47D3B; font-size: 22px; }
  </style>
</head>
<body>
  <div class="header"><img src="cid:bosa_logo" width="180" /></div>
  <div class="content">
    <h2 class="title">Nuevo Aviso Publicado</h2>
    <p>Hola <strong>${name}</strong>,</p>
    <p>Hay un nuevo comunicado importante en la plataforma:</p>
    <div style="background: #fff8e1; padding: 20px; border-radius: 8px; border: 1px solid #ffe082;">
      <h3 style="margin-top: 0;">${aviso.title}</h3>
      <p>${aviso.content}</p>
    </div>
  </div>
</body>
</html>
  `;
};

const getMeetingEmailTemplate = (name, meeting) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; color: #333; }
    .header { background: #0A1930; padding: 20px; text-align: center; }
    .content { padding: 30px; }
  </style>
</head>
<body>
  <div class="header"><img src="cid:bosa_logo" width="180" /></div>
  <div class="content">
    <h2 style="color: #A47D3B;">Nueva Reunión Programada</h2>
    <p>Hola <strong>${name}</strong>,</p>
    <p>Has sido invitado a una nueva reunión:</p>
    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
      <p><strong>Evento:</strong> ${meeting.title}</p>
      <p><strong>Organizador:</strong> ${meeting.created_by_name || 'No indicado'}</p>
      <p><strong>Modalidad:</strong> ${meeting.location_label || 'Sala de juntas'}</p>
      <p><strong>Inicio:</strong> ${new Date(meeting.start_time).toLocaleString('es-MX')}</p>
      <p><strong>Fin:</strong> ${new Date(meeting.end_time).toLocaleString('es-MX')}</p>
    </div>
  </div>
</body>
</html>
  `;
};

const getTaskEmailTemplate = (name, task) => {
  const fmt = (ymd) => {
    if (!ymd) return '—';
    try {
      return new Date(String(ymd).includes('T') ? ymd : `${ymd}T12:00:00`).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return ymd;
    }
  };
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; color: #333; line-height: 1.6; }
    .header { background: #0A1930; padding: 20px; text-align: center; }
    .content { padding: 30px; border: 1px solid #eee; border-radius: 8px; margin-top: 20px; }
    .title { color: #A47D3B; font-size: 20px; font-weight: bold; }
    .footer { font-size: 12px; color: #999; margin-top: 30px; text-align: center; }
  </style>
</head>
<body>
  <div class="header"><img src="cid:bosa_logo" width="180" alt="BOSA" /></div>
  <div class="content">
    <h2 class="title">Nueva tarea operativa asignada</h2>
    <p>Hola <strong>${name}</strong>,</p>
    <p>Se te asignó un tramo de trabajo en el sistema:</p>
    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; border-left: 4px solid #A47D3B;">
      <p><strong>Tarea:</strong> ${task.title || '—'}</p>
      ${task.ticket_id ? `<p><strong>Ticket:</strong> #${task.ticket_id} — ${task.ticket_title || '—'}</p>` : '<p><strong>Origen:</strong> Tarea independiente (sin ticket)</p>'}
      <p><strong>Departamento:</strong> ${task.department || '—'}</p>
      <p><strong>Asignó:</strong> ${task.assigned_by_name || '—'}</p>
      <p><strong>Inicio:</strong> ${fmt(task.start_date)}</p>
      <p><strong>Fin:</strong> ${fmt(task.end_date)}</p>
    </div>
    <p style="margin-top: 20px;">Revisa el cronograma de <strong>Tareas operativas</strong> o el ticket en BOSA HUB para actualizar el estado.</p>
  </div>
  <div class="footer">
    &copy; ${new Date().getFullYear()} BOSA. Sistema Operativo Central.
  </div>
</body>
</html>
  `;
};

module.exports = {
  getWelcomeEmailTemplate,
  getTicketEmailTemplate,
  getAvisoEmailTemplate,
  getMeetingEmailTemplate,
  getTaskEmailTemplate,
};
