const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const ctrl = require('../controllers/ticketTaskController');
const { authenticate } = require('../middleware/auth');
const { fileFilter } = require('../middleware/uploadFilter');

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
  },
});

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(authenticate);

router.get('/', ctrl.listTasks);
router.post('/', ctrl.createStandaloneTask);
router.get('/by-ticket/:ticketId', ctrl.listTasksByTicket);
router.post('/by-ticket/:ticketId', ctrl.createTask);
router.get('/:id', ctrl.getTaskDetail);
router.post('/:id/comments', ctrl.addTaskComment);
router.post('/:id/request-completion', ctrl.requestTaskCompletion);
router.post('/:id/attachments', upload.single('file'), ctrl.uploadTaskAttachment);
router.delete('/:id/attachments/:attachmentId', ctrl.deleteTaskAttachment);
router.patch('/:id', ctrl.updateTask);
router.delete('/:id', ctrl.deleteTask);

module.exports = router;
