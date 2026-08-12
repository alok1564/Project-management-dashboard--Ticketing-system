const express = require('express');
const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.post('/tickets/:id/comments', async (req, res) => {
  try {
    const { text } = req.body;
    const ticketId = req.params.id;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Check permissions
    if (req.user.role === 'client' && ticket.requester.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Cannot comment on other users\' tickets' });
    }
    if (req.user.role === 'employee' && (!ticket.assignee || ticket.assignee.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: 'Cannot comment on unassigned tickets' });
    }

    const comment = new Comment({
      ticket: ticketId,
      author: req.user._id,
      text: text.trim()
    });
    
    await comment.save();
    
    ticket.lastActivity = Date.now();
    await ticket.save();

    const populatedComment = await Comment.findById(comment._id)
      .populate('author', 'name email role');

    res.status(201).json(populatedComment);
  } catch (error) {
    res.status(500).json({ message: 'Server error creating comment' });
  }
});

module.exports = router;
