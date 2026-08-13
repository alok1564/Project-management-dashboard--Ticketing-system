const express = require('express');
const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');
const User = require('../models/User');
const ClientProfile = require('../models/ClientProfile');
const EmployeeProfile = require('../models/EmployeeProfile');
const TicketHistory = require('../models/TicketHistory');
const AuditLog = require('../models/AuditLog');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

const AUTO_IN_PROGRESS_MS = 5 * 60 * 1000; // 5 minutes 

async function autoAdvanceToInProgress(ticket) {
  if (ticket.status !== 'Assigned' || !ticket.assignedAt || !ticket.assignee) {
    return;
  }

  const assignedAtMs = new Date(ticket.assignedAt).getTime();
  const nowMs = Date.now();
  if (nowMs - assignedAtMs < AUTO_IN_PROGRESS_MS) {
    return;
  }

  const updated = await Ticket.findOneAndUpdate(
    { _id: ticket._id, status: 'Assigned' },
    { status: 'In Progress', lastActivity: Date.now() },
    { new: true }
  );

  if (!updated) return;

  ticket.status = updated.status;
  ticket.lastActivity = updated.lastActivity;

  await Comment.create({
    ticket: ticket._id,
    author: ticket.assignee._id || ticket.assignee,
    text: 'Ticket status has been changed to In Progress',
    isActivity: true,
    isSystem: true
  });

  await TicketHistory.create({
    ticketId: ticket._id,
    userId: null,
    action: 'status_changed',
    oldValue: 'Assigned',
    newValue: 'In Progress'
  });
}

// GET /api/tickets — list tickets scoped by role, with optional filters
router.get('/', async (req, res) => {
  try {
    const { status, assignee, priority, search, page = 1, limit = 100 } = req.query;
    const query = {};

    // Role-based scoping
    if (req.user.role === 'client') {
      query.requester = req.user._id;
    } else if (req.user.role === 'employee') {
      query.assignee = req.user._id;
    } else if (req.user.role === 'pm') {
      // PM only sees tickets belonging to their clients
      query.managerId = req.user._id;
    }
    // Admin sees all tickets (no scoping)

    // Apply optional filters
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }
    if (assignee) {
      if (assignee === 'unassigned') {
        query.assignee = null;
      } else if (req.user.role === 'pm' || req.user.role === 'admin') {
        query.assignee = assignee;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Ticket.countDocuments(query);
    const tickets = await Ticket.find(query)
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('requester', 'name email role')
      .populate('assignee', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('managerId', 'name email')
      .populate('projectId', 'name');

    for (const ticket of tickets) {
      await autoAdvanceToInProgress(ticket);
    }

    res.json({
      tickets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('List tickets error:', error);
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

    // Look up client profile to find assigned PM and project
    const clientProfile = await ClientProfile.findOne({ userId: req.user._id });
    const managerId = clientProfile ? clientProfile.managerId : null;
    const projectId = clientProfile ? clientProfile.projectId : null;

    const newTicket = new Ticket({
      title,
      description,
      priority: priority || 'P3',
      requester: req.user._id,
      status: 'New',
      managerId,
      projectId
    });

    await newTicket.save();

    // Create ticket history
    await TicketHistory.create({
      ticketId: newTicket._id,
      userId: req.user._id,
      action: 'created',
      newValue: 'New'
    });

    const populated = await Ticket.findById(newTicket._id)
      .populate('requester', 'name email role')
      .populate('assignee', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('managerId', 'name email')
      .populate('projectId', 'name');

    res.status(201).json(populated);
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ message: 'Server error creating ticket' });
  }
});

// GET /api/tickets/:id — single ticket detail with comments and history
router.get('/:id', async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('requester', 'name email role')
      .populate('assignee', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('managerId', 'name email')
      .populate('projectId', 'name description status');

    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // Access checks
    if (req.user.role === 'client' && ticket.requester._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (req.user.role === 'employee' && (!ticket.assignee || ticket.assignee._id.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (req.user.role === 'pm' && (!ticket.managerId || ticket.managerId._id.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await autoAdvanceToInProgress(ticket);

    const comments = await Comment.find({ ticket: ticket._id })
      .sort({ createdAt: 1 })
      .populate('author', 'name email role');

    const history = await TicketHistory.find({ ticketId: ticket._id })
      .sort({ timestamp: 1 })
      .populate('userId', 'name email role');

    res.json({ ticket, comments, history });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ message: 'Server error fetching ticket' });
  }
});

// GET /api/tickets/:id/history — ticket history only
router.get('/:id/history', async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // Same access checks
    if (req.user.role === 'client' && ticket.requester.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (req.user.role === 'employee' && (!ticket.assignee || ticket.assignee.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (req.user.role === 'pm' && (!ticket.managerId || ticket.managerId.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const history = await TicketHistory.find({ ticketId: ticket._id })
      .sort({ timestamp: 1 })
      .populate('userId', 'name email role');

    res.json(history);
  } catch (error) {
    console.error('Get ticket history error:', error);
    res.status(500).json({ message: 'Server error fetching ticket history' });
  }
});

// PUT /api/tickets/:id — update ticket (assign / close / status changes)
router.put('/:id', async (req, res) => {
  try {
    const { status, assignee } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // PM access check
    if (req.user.role === 'pm' && ticket.managerId && ticket.managerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied: this ticket is not under your management' });
    }

    const activityComments = [];

    // Handle assignee update
    if (assignee !== undefined) {
      if (req.user.role !== 'pm' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only PM or Admin can assign tickets' });
      }

      if (assignee) {
        const employee = await User.findById(assignee);
        if (!employee) return res.status(400).json({ message: 'Assignee not found' });
        if (employee.status === 'inactive') return res.status(400).json({ message: 'Cannot assign to inactive employee' });

        // PM can only assign their own employees
        if (req.user.role === 'pm') {
          const empProfile = await EmployeeProfile.findOne({ userId: assignee, managerId: req.user._id });
          if (!empProfile) {
            return res.status(403).json({ message: 'Cannot assign to an employee that does not belong to you' });
          }
        }

        const oldAssignee = ticket.assignee;
        ticket.assignee = employee._id;
        ticket.assignedBy = req.user._id;
        ticket.assignedAt = Date.now();
        if (ticket.status === 'New' || ticket.status === 'Assigned' || ticket.status === 'Reopened') {
          ticket.status = 'Assigned';
        }
        activityComments.push({
          ticket: ticket._id,
          author: req.user._id,
          text: `assigned this ticket to ${employee.name}`,
          isActivity: true
        });

        await TicketHistory.create({
          ticketId: ticket._id,
          userId: req.user._id,
          action: 'assigned',
          oldValue: oldAssignee ? oldAssignee.toString() : null,
          newValue: employee.name
        });
      } else {
        const oldAssignee = ticket.assignee;
        ticket.assignee = null;
        ticket.assignedBy = null;
        ticket.assignedAt = null;
        activityComments.push({
          ticket: ticket._id,
          author: req.user._id,
          text: 'unassigned this ticket',
          isActivity: true
        });

        await TicketHistory.create({
          ticketId: ticket._id,
          userId: req.user._id,
          action: 'unassigned',
          oldValue: oldAssignee ? oldAssignee.toString() : null
        });
      }
    }

    // Handle status update
    if (status !== undefined) {
      const oldStatus = ticket.status;

      if (status === 'Closed') {
        const isAssignedEmployee =
          req.user.role === 'employee' &&
          ticket.assignee &&
          ticket.assignee.toString() === req.user._id.toString();
        const isPmOrAdmin = req.user.role === 'pm' || req.user.role === 'admin';

        if (!isAssignedEmployee && !isPmOrAdmin) {
          return res.status(403).json({ message: 'Only the assigned employee, PM, or Admin can close this ticket' });
        }
        if (ticket.status === 'Closed') {
          return res.status(400).json({ message: 'Ticket is already closed' });
        }

        ticket.status = 'Closed';
        activityComments.push({
          ticket: ticket._id,
          author: req.user._id,
          text: 'closed this ticket',
          isActivity: true
        });
      } else if (status === 'Waiting for Client') {
        if (req.user.role !== 'pm' && req.user.role !== 'admin' && !(req.user.role === 'employee' && ticket.assignee && ticket.assignee.toString() === req.user._id.toString())) {
          return res.status(403).json({ message: 'Cannot change status' });
        }
        ticket.status = 'Waiting for Client';
        activityComments.push({
          ticket: ticket._id,
          author: req.user._id,
          text: 'set status to Waiting for Client',
          isActivity: true
        });
      } else if (status === 'Resolved') {
        if (req.user.role !== 'pm' && req.user.role !== 'admin' && !(req.user.role === 'employee' && ticket.assignee && ticket.assignee.toString() === req.user._id.toString())) {
          return res.status(403).json({ message: 'Cannot change status' });
        }
        ticket.status = 'Resolved';
        activityComments.push({
          ticket: ticket._id,
          author: req.user._id,
          text: 'marked ticket as Resolved',
          isActivity: true
        });
      } else if (status === 'In Progress') {
        if (req.user.role !== 'pm' && req.user.role !== 'admin' && !(req.user.role === 'employee' && ticket.assignee && ticket.assignee.toString() === req.user._id.toString())) {
          return res.status(403).json({ message: 'Cannot change status' });
        }
        ticket.status = 'In Progress';
        activityComments.push({
          ticket: ticket._id,
          author: req.user._id,
          text: 'set status to In Progress',
          isActivity: true
        });
      } else {
        return res.status(400).json({ message: 'Invalid status transition' });
      }

      if (oldStatus !== ticket.status) {
        await TicketHistory.create({
          ticketId: ticket._id,
          userId: req.user._id,
          action: status === 'Closed' ? 'closed' : 'status_changed',
          oldValue: oldStatus,
          newValue: ticket.status
        });
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
      .populate('assignedBy', 'name email role')
      .populate('managerId', 'name email')
      .populate('projectId', 'name');

    res.json(updatedTicket);
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ message: 'Server error updating ticket' });
  }
});

// POST /api/tickets/:id/comments — add a comment / reopen
router.post('/:id/comments', async (req, res) => {
  try {
    const { text, reopen } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // Access check
    if (req.user.role === 'client' && ticket.requester.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (req.user.role === 'employee' && (!ticket.assignee || ticket.assignee.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (req.user.role === 'pm' && ticket.managerId && ticket.managerId.toString() !== req.user._id.toString()) {
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
      ticket.assignee = null;
      ticket.assignedBy = null;
      ticket.assignedAt = null;

      await TicketHistory.create({
        ticketId: ticket._id,
        userId: req.user._id,
        action: 'reopened',
        oldValue: 'Closed',
        newValue: 'Reopened'
      });
    }

    const comment = new Comment({
      ticket: ticket._id,
      author: req.user._id,
      text: text.trim(),
      isReopen
    });
    await comment.save();

    // Create history for comment
    await TicketHistory.create({
      ticketId: ticket._id,
      userId: req.user._id,
      action: 'commented',
      newValue: text.trim().substring(0, 100)
    });

    ticket.lastActivity = Date.now();
    await ticket.save();

    const populated = await Comment.findById(comment._id).populate('author', 'name email role');

    res.status(201).json(populated);
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error adding comment' });
  }
});

module.exports = router;