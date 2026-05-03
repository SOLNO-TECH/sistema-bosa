const nodemailer = require('nodemailer');
const path = require('path');
const { getWelcomeEmailTemplate } = require('../utils/emailTemplates');

// Create a transporter using environment variables
// It will only be active if SMTP settings are provided
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

const sendWelcomeEmail = async (name, email, password, role) => {
  const transporter = createTransporter();
  if (!transporter) return;

  const htmlContent = getWelcomeEmailTemplate(name, email, password, role);

  const mailOptions = {
    from: `"BOSA" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
    to: email,
    subject: '¡Bienvenido a BOSA! - Tu cuenta ha sido creada',
    html: htmlContent,
    attachments: [
      {
        filename: 'logo.png',
        path: path.join(__dirname, '../../../frontend/public/logo.png'),
        cid: 'bosa_logo' // must match the cid in the img src
      }
    ]
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Correo enviado exitosamente a ${email} [${info.messageId}]`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando correo de bienvenida:', error);
    return false;
  }
};

module.exports = {
  sendWelcomeEmail
};
