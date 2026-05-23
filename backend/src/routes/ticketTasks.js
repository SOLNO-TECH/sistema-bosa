const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/ticketTaskController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.listTasks);
router.post('/', ctrl.createStandaloneTask);
router.get('/by-ticket/:ticketId', ctrl.listTasksByTicket);
router.post('/by-ticket/:ticketId', ctrl.createTask);
router.patch('/:id', ctrl.updateTask);
router.delete('/:id', ctrl.deleteTask);

module.exports = router;
