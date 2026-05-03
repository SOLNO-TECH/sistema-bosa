const getWelcomeEmailTemplate = (name, email, password, role) => {
  const roleName = role === 'superadmin' ? 'Super Administrador' : 'Administrador';
  
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
          <a href="http://localhost:5173/login" class="btn">Acceder al Portal</a>
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

module.exports = {
  getWelcomeEmailTemplate
};
