const express = require('express');
const router = express.Router();
const knowledgeController = require('../controllers/knowledgeController');
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadKnowledgeMedia } = require('../middleware/knowledgeUpload');

router.use(authenticate);

router.get('/', knowledgeController.listKnowledgeLinks);
router.post(
  '/media',
  requireRole('superadmin'),
  uploadKnowledgeMedia.single('file'),
  knowledgeController.uploadKnowledgeMedia,
);
router.post('/', requireRole('superadmin'), knowledgeController.createKnowledgeLink);
router.put('/:id', requireRole('superadmin'), knowledgeController.updateKnowledgeLink);
router.delete('/:id', requireRole('superadmin'), knowledgeController.deleteKnowledgeLink);

module.exports = router;
