const express = require('express');
const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');
const User = require('../models/User');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

const AUTO_IN_PROGRESS_MS = 5 * 60 * 1000; // 30 minutes

// If a ticket has sat in 'Assigned' status for 30+ minutes since assignedAt,
// flip it to 'In Progress' and log the transition in the comment thread.
// Date.now() and Date.getTime() are always UTC epoch ms in Node, so this
// comparison is inherently timezone-safe — no explicit UTC conversion needed.
// Called on every read (list + detail) since there's no scheduled job.
//
// The status flip uses an atomic, conditional findOneAndUpdate (only
// succeeds if status is still 'Assigned' at write time) instead of a plain
// save(). This prevents the race where two near-simultaneous requests (e.g.
// the dashboard list and the detail page both loading around the same
// moment) each read the ticket while it's still 'Assigned' and both try to
// log the transition — only one of them will actually win the update, so
// only one activity comment gets created.
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

  if (!updated) {
    // Another concurrent request already advanced it — nothing more to do.
    return;
  }

  ticket.status = updated.status;
  ticket.lastActivity = updated.lastActivity;

  await Comment.create({
    ticket: ticket._id,
    author: ticket.assignee._id || ticket.assignee,
    text: 'Ticket status has been changed to In Progress',
    isActivity: true,
    isSystem: true
  });
}

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

    for (const ticket of tickets) {
      await autoAdvanceToInProgress(ticket);
    }

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
      priority: priority || 'P3',
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

    // Apply the 30-min auto-transition before loading comments, so a just-triggered
    // activity entry shows up in the same response.
    await autoAdvanceToInProgress(ticket);

    const comments = await Comment.find({ ticket: ticket._id })
      .sort({ createdAt: 1 })
      .populate('author', 'name email role');

    res.json({ ticket, comments });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching ticket' });
  }
});

// PUT /api/tickets/:id — update ticket (assign / close).
// 'Closed' is the only explicit status transition left. 'In Progress' is no
// longer set by any user action — it happens automatically 30 minutes after
// assignment (see autoAdvanceToInProgress). New/Reopened -> Assigned still
// happens automatically as a side effect of assignment. Reopened continues
// to be treated exactly like New everywhere.
//
// Close permissions: PM/Admin can close a ticket from any non-Closed phase.
// An employee can close a ticket only if it is currently assigned to them,
// from any non-Closed phase (Assigned or In Progress).
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
        ticket.assignedAt = Date.now(); // starts the 30-minute auto In Progress timer
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
        ticket.assignedAt = null;
        activityComments.push({
          ticket: ticket._id,
          author: req.user._id,
          text: 'unassigned this ticket',
          isActivity: true
        });
      }
    }

    // Handle status update
    if (status !== undefined) {
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
// Reopening also clears the previous assignee (and assignedAt): the ticket
// goes back to Unassigned until a PM/Admin assigns it again, same as a
// brand-new ticket.
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
      ticket.assignee = null;
      ticket.assignedBy = null;
      ticket.assignedAt = null;
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