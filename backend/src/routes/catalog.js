const express = require('express');
const router = express.Router();
const catalogController = require('../controllers/catalogController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/departments', catalogController.listDepartments);
router.get('/roles', catalogController.listRoles);
router.post('/departments', requireRole('superadmin'), catalogController.createDepartment);
router.post('/roles', requireRole('superadmin'), catalogController.createRole);

module.exports = router;
