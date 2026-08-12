const express = require('express');
const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');
const User = require('../models/User');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// GET /api/tickets — list tickets scoped by role, with optional filters
router.get('/', async (req, res) => {
  try {
    const { status, assignee } = req.query;
    const query = {};

    // Role-based scoping
    if (req.user.role === 'client') {
      query.requester = req.user._id;
    } else if (req.user.role === 'employee') {
      query.assignee = req.user._id;
    }
    // PM and Admin see all tickets (no scoping filter)

    // Apply optional filters (available to all roles within their scope)
    if (status) query.status = status;
    if (assignee) {
      // Only PM/Admin can filter by assignee
      if (req.user.role === 'pm' || req.user.role === 'admin') {
        query.assignee = assignee;
      }
    }

    const tickets = await Ticket.find(query)
      .sort({ lastActivity: -1 })
      .populate('requester', 'name email role')
      .populate('assignee', 'name email role')
      .populate('assignedBy', 'name email role');

    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching tickets' });
  }
});

// POST /api/tickets — client creates a ticket
router.post('/', requireRole('client'), async (req, res) => {
  try {
    const { title, description, priority } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required' });
    }

    const newTicket = new Ticket({
      title,
      description,
      priority: priority || 'Medium',
      requester: req.user._id,
      status: 'New'
    });

    await newTicket.save();

    const populated = await Ticket.findById(newTicket._id)
      .populate('requester', 'name email role')
      .populate('assignee', 'name email role')
      .populate('assignedBy', 'name email role');

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error creating ticket' });
  }
});

// GET /api/tickets/:id — single ticket detail with comments
router.get('/:id', async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('requester', 'name email role')
      .populate('assignee', 'name email role')
      .populate('assignedBy', 'name email role');

    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // Ensure access rights
    if (req.user.role === 'client' && ticket.requester._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (req.user.role === 'employee' && (!ticket.assignee || ticket.assignee._id.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const comments = await Comment.find({ ticket: ticket._id })
      .sort({ createdAt: 1 })
      .populate('author', 'name email role');

    res.json({ ticket, comments });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching ticket' });
  }
});

// PUT /api/tickets/:id — update ticket (assign / start work / close).
// Status can no longer be set to an arbitrary value — only the two
// explicit, user-triggered transitions below are allowed. New/Reopened -> Assigned
// still happens automatically as a side effect of assignment. Reopened is treated
// exactly like New everywhere: it must go through Assigned -> In Progress -> Closed
// again, same as any other ticket.
router.put('/:id', async (req, res) => {
  try {
    const { status, assignee } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    const activityComments = [];

    // Handle assignee update
    if (assignee !== undefined) {
      if (req.user.role !== 'pm' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only PM or Admin can assign tickets' });
      }

      if (assignee) {
        const employee = await User.findById(assignee);
        if (!employee) return res.status(400).json({ message: 'Assignee not found' });

        ticket.assignee = employee._id;
        ticket.assignedBy = req.user._id;
        if (ticket.status === 'New' || ticket.status === 'Assigned' || ticket.status === 'Reopened') {
          ticket.status = 'Assigned';
        }
        activityComments.push({
          ticket: ticket._id,
          author: req.user._id,
          text: `assigned this ticket to ${employee.name}`,
          isActivity: true
        });
      } else {
        ticket.assignee = null;
        ticket.assignedBy = null;
        activityComments.push({
          ticket: ticket._id,
          author: req.user._id,
          text: 'unassigned this ticket',
          isActivity: true
        });
      }
    }

    // Handle status update — only 'In Progress' (start work) and 'Closed'
    // are valid explicit transitions; anything else is rejected.
    if (status !== undefined) {
      if (status === 'In Progress') {
        const isAssignedEmployee =
          req.user.role === 'employee' &&
          ticket.assignee &&
          ticket.assignee.toString() === req.user._id.toString();

        if (!isAssignedEmployee) {
          return res.status(403).json({ message: 'Only the assigned employee can start work' });
        }
        if (ticket.status !== 'Assigned') {
          return res.status(400).json({ message: 'Ticket must be Assigned before work can start' });
        }

        ticket.status = 'In Progress';
        activityComments.push({
          ticket: ticket._id,
          author: req.user._id,
          text: 'started working on this ticket',
          isActivity: true
        });
      } else if (status === 'Closed') {
        const isAssignedEmployee =
          req.user.role === 'employee' &&
          ticket.assignee &&
          ticket.assignee.toString() === req.user._id.toString();
        const isPmOrAdmin = req.user.role === 'pm' || req.user.role === 'admin';

        if (!isAssignedEmployee && !isPmOrAdmin) {
          return res.status(403).json({ message: 'Only the assigned employee, PM, or Admin can close this ticket' });
        }
        if (ticket.status !== 'In Progress') {
          return res.status(400).json({ message: 'Ticket must be In Progress before it can be closed' });
        }

        ticket.status = 'Closed';
        activityComments.push({
          ticket: ticket._id,
          author: req.user._id,
          text: 'closed this ticket',
          isActivity: true
        });
      } else {
        return res.status(400).json({ message: 'Invalid status transition' });
      }
    }

    ticket.lastActivity = Date.now();
    await ticket.save();

    if (activityComments.length) {
      await Comment.insertMany(activityComments);
    }

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate('requester', 'name email role')
      .populate('assignee', 'name email role')
      .populate('assignedBy', 'name email role');

    res.json(updatedTicket);
  } catch (error) {
    res.status(500).json({ message: 'Server error updating ticket' });
  }
});

// POST /api/tickets/:id/comments — add a comment to a ticket.
// If `reopen: true` is sent, the requesting client can reopen a Closed ticket
// in the same request — the comment is flagged isReopen so the frontend can
// render "X reopened this ticket and commented" inline in the same thread.
router.post('/:id/comments', async (req, res) => {
  try {
    const { text, reopen } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // Access check — same rule as GET /:id
    if (req.user.role === 'client' && ticket.requester.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (req.user.role === 'employee' && (!ticket.assignee || ticket.assignee.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }

    let isReopen = false;
    if (reopen) {
      if (req.user.role !== 'client' || ticket.requester.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Only the requesting client can reopen this ticket' });
      }
      if (ticket.status !== 'Closed') {
        return res.status(400).json({ message: 'Only closed tickets can be reopened' });
      }
      isReopen = true;
      ticket.status = 'Reopened';
    }

    const comment = new Comment({
      ticket: ticket._id,
      author: req.user._id,
      text: text.trim(),
      isReopen
    });
    await comment.save();

    // Bump lastActivity so the ticket resorts to the top of the list
    ticket.lastActivity = Date.now();
    await ticket.save();

    const populated = await Comment.findById(comment._id).populate('author', 'name email role');

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error adding comment' });
  }
});

module.exports = router;