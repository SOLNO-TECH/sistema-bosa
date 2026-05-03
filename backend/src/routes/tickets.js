const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { verifyToken } = require('../middleware/auth'); // Assuming auth middleware exists

router.get('/', ticketController.getTickets);
router.post('/', ticketController.createTicket);
router.patch('/:id/status', ticketController.updateTicketStatus);

module.exports = router;
