const express = require('express');
const User = require('../models/User');
const ClientProfile = require('../models/ClientProfile');
const Project = require('../models/Project');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// GET /api/clients/me/projects — logged-in client's own projects (for ticket creation)
// Must be declared before GET /:id, otherwise "/me/projects" would be matched
// as :id = "me" and rejected by that route's admin/pm-only role check.
router.get('/me/projects', requireRole('client'), async (req, res) => {
  try {
    const clientProfile = await ClientProfile.findOne({ userId: req.user._id })
      .populate({ path: 'projectIds', select: 'name status managerId', populate: { path: 'managerId', select: 'name' } });
    res.json(clientProfile ? clientProfile.projectIds : []);
  } catch (error) {
    console.error('Get own projects error:', error);
    res.status(500).json({ message: 'Server error fetching your projects' });
  }
});

// GET /api/clients/projects — flat project list for the PM/Admin project dropdown
// Admin: all projects. PM: only projects they manage.
// Must be declared before GET /:id, otherwise "/projects" would be matched
// as :id = "projects" and rejected by that route's client-role lookup.
router.get('/projects', requireRole('admin', 'pm'), async (req, res) => {
  try {
    const query = {};
    if (req.user.role === 'pm') {
      // Same managerId field GET / (list clients) keys off of, so PM scoping
      // stays consistent across both endpoints instead of diverging.
      query.managerId = req.user._id;
    }

    const projects = await Project.find(query, 'name status clientId managerId')
      .populate('clientId', 'name email')
      .populate('managerId', 'name email')
      .sort({ name: 1 });

    res.json(projects);
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({ message: 'Server error fetching projects' });
  }
});

// GET /api/clients — List clients
// Admin sees all; PM sees only clients who have at least one project managed by them
router.get('/', requireRole('admin', 'pm'), async (req, res) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;
    let clientIdFilter = null;

    if (req.user.role === 'pm') {
      // A client belongs to this PM's view if any of their projects is managed by this PM
      const pmProjects = await Project.find({ managerId: req.user._id }).select('clientId');
      clientIdFilter = [...new Set(pmProjects.map(p => p.clientId.toString()))];
    }

    const userQuery = { role: 'client' };
    if (clientIdFilter) userQuery._id = { $in: clientIdFilter };
    if (status) userQuery.status = status;
    if (search) {
      userQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.countDocuments(userQuery);
    const clients = await User.find(userQuery, '-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Attach profile and projects (each project carries its own PM)
    const enriched = await Promise.all(clients.map(async (client) => {
      const profile = await ClientProfile.findOne({ userId: client._id })
        .populate({ path: 'projectIds', select: 'name status description managerId', populate: { path: 'managerId', select: 'name email' } });
      return { ...client.toObject(), profile };
    }));

    res.json({
      clients: enriched,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('List clients error:', error);
    res.status(500).json({ message: 'Server error fetching clients' });
  }
});

// GET /api/clients/:id — Client detail
router.get('/:id', requireRole('admin', 'pm'), async (req, res) => {
  try {
    const client = await User.findOne({ _id: req.params.id, role: 'client' }, '-password');
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const profile = await ClientProfile.findOne({ userId: client._id })
      .populate({ path: 'projectIds', populate: { path: 'managerId', select: 'name email role' } });

    // PM can only view clients who have at least one project managed by them
    if (req.user.role === 'pm') {
      const hasAccess = profile && profile.projectIds.some(
        (p) => p.managerId && p.managerId._id.toString() === req.user._id.toString()
      );
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.json({ client, profile });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ message: 'Server error fetching client' });
  }
});

// PATCH /api/clients/:id/manager — Reassign the PM for one of a client's projects (Admin only).
// Since each project has its own PM, projectId is required to identify which
// project is being reassigned.
router.patch('/:id/manager', requireRole('admin'), async (req, res) => {
  try {
    const { managerId, projectId } = req.body;
    if (!managerId) {
      return res.status(400).json({ message: 'Manager ID is required' });
    }
    if (!projectId) {
      return res.status(400).json({ message: 'Project ID is required (each project has its own PM)' });
    }

    const client = await User.findOne({ _id: req.params.id, role: 'client' });
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const newPM = await User.findOne({ _id: managerId, role: 'pm', status: 'active' });
    if (!newPM) {
      return res.status(400).json({ message: 'Selected PM not found or inactive' });
    }

    const clientProfile = await ClientProfile.findOne({ userId: client._id });
    if (!clientProfile) {
      return res.status(404).json({ message: 'Client profile not found' });
    }

    const belongsToClient = clientProfile.projectIds.some(
      (id) => id.toString() === projectId.toString()
    );
    if (!belongsToClient) {
      return res.status(400).json({ message: 'That project does not belong to this client' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    project.managerId = managerId;
    await project.save();

    res.json({ message: 'Project PM reassigned successfully' });
  } catch (error) {
    console.error('Reassign client PM error:', error);
    res.status(500).json({ message: 'Server error reassigning PM' });
  }
});

module.exports = router;