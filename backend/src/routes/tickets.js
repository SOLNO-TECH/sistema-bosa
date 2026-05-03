const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de Multer para archivos adjuntos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../data/uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

router.get('/', ticketController.getTickets);
router.get('/:id', ticketController.getTicketDetails);
router.post('/', ticketController.createTicket);
router.patch('/:id/status', ticketController.updateTicketStatus);
router.post('/:id/comments', ticketController.addComment);
router.post('/:id/attachments', upload.single('file'), ticketController.uploadAttachment);

module.exports = router;
