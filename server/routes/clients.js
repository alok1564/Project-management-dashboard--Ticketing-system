const express = require('express');
const User = require('../models/User');
const ClientProfile = require('../models/ClientProfile');
const Project = require('../models/Project');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// GET /api/clients — List clients
// Admin sees all; PM sees their clients only
router.get('/', requireRole('admin', 'pm'), async (req, res) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;
    const profileQuery = {};

    if (req.user.role === 'pm') {
      profileQuery.managerId = req.user._id;
    }

    const profiles = await ClientProfile.find(profileQuery).select('userId');
    const clientIds = profiles.map(p => p.userId);

    const userQuery = { _id: { $in: clientIds }, role: 'client' };
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

    // Attach profiles and projects
    const enriched = await Promise.all(clients.map(async (client) => {
      const profile = await ClientProfile.findOne({ userId: client._id })
        .populate('managerId', 'name email')
        .populate('projectId', 'name status description');
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
      .populate('managerId', 'name email role')
      .populate('projectId');

    // PM can only view their own clients
    if (req.user.role === 'pm' && profile && profile.managerId && profile.managerId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ client, profile });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ message: 'Server error fetching client' });
  }
});

// PATCH /api/clients/:id/manager — Reassign PM (Admin only)
router.patch('/:id/manager', requireRole('admin'), async (req, res) => {
  try {
    const { managerId } = req.body;
    if (!managerId) {
      return res.status(400).json({ message: 'Manager ID is required' });
    }

    const client = await User.findOne({ _id: req.params.id, role: 'client' });
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const newPM = await User.findOne({ _id: managerId, role: 'pm', status: 'active' });
    if (!newPM) {
      return res.status(400).json({ message: 'Selected PM not found or inactive' });
    }

    const profile = await ClientProfile.findOne({ userId: client._id });
    if (!profile) {
      return res.status(404).json({ message: 'Client profile not found' });
    }

    const oldManagerId = profile.managerId;
    profile.managerId = managerId;
    await profile.save();

    // Update project's managerId too
    if (profile.projectId) {
      await Project.findByIdAndUpdate(profile.projectId, { managerId });
    }

    res.json({ message: 'Client PM reassigned successfully' });
  } catch (error) {
    console.error('Reassign client PM error:', error);
    res.status(500).json({ message: 'Server error reassigning PM' });
  }
});

module.exports = router;
