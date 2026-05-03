const nodemailer = require('nodemailer');
const path = require('path');
const { 
  getWelcomeEmailTemplate, 
  getTicketEmailTemplate, 
  getAvisoEmailTemplate, 
  getMeetingEmailTemplate 
} = require('../utils/emailTemplates');

const createTransporter = () => {
  if (!process.env.SMTP_HOST) {
    console.warn('⚠️ SMTP config not found. Emails will not be sent.');
    return null;
  }
  
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 465,
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT == 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const sendMail = async (to, subject, html) => {
  const transporter = createTransporter();
  if (!transporter) {
    console.error('❌ No se pudo enviar correo: Transporter no configurado (faltan variables de entorno)');
    return false;
  }

  const mailOptions = {
    from: `"BOSA" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    attachments: [
      {
        filename: 'logo.png',
        path: path.join(__dirname, '../../../frontend/public/logo.png'),
        cid: 'bosa_logo'
      }
    ]
  };

  try {
    console.log(`✉️ Intentando enviar correo a: ${to} - Asunto: ${subject}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Correo enviado exitosamente a ${to}. ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error crítico enviando correo a ${to}:`, error.message);
    if (error.code) console.error(`   Código de error SMTP: ${error.code}`);
    if (error.command) console.error(`   Comando fallido: ${error.command}`);
    return false;
  }
};

const sendWelcomeEmail = async (name, email, password, role) => {
  const html = getWelcomeEmailTemplate(name, email, password, role);
  return sendMail(email, '¡Bienvenido a BOSA! - Tu cuenta ha sido creada', html);
};

const sendTicketNotification = async (userName, userEmail, ticket) => {
  const html = getTicketEmailTemplate(userName, ticket);
  return sendMail(userEmail, `Ticket Asignado: ${ticket.title}`, html);
};

const sendAvisoNotification = async (userName, userEmail, aviso) => {
  const html = getAvisoEmailTemplate(userName, aviso);
  return sendMail(userEmail, `Nuevo Aviso BOSA: ${aviso.title}`, html);
};

const sendMeetingNotification = async (userName, userEmail, meeting) => {
  const html = getMeetingEmailTemplate(userName, meeting);
  return sendMail(userEmail, `Invitación a Reunión: ${meeting.title}`, html);
};

module.exports = {
  sendWelcomeEmail,
  sendTicketNotification,
  sendAvisoNotification,
  sendMeetingNotification
};
