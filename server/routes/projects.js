const express = require('express');
const Project = require('../models/Project');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// GET /api/projects
router.get('/', requireRole('admin', 'pm'), async (req, res) => {
  try {
    const query = {};
    if (req.user.role === 'pm') {
      query.managerId = req.user._id;
    }
    if (req.query.status) {
      query.status = req.query.status;
    }

    const projects = await Project.find(query)
      .populate('clientId', 'name email status')
      .populate('managerId', 'name email')
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({ message: 'Server error fetching projects' });
  }
});

// GET /api/projects/:id
router.get('/:id', requireRole('admin', 'pm', 'client'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('clientId', 'name email status')
      .populate('managerId', 'name email');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // PM can only view their own projects
    if (req.user.role === 'pm' && project.managerId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Client can only view their own project
    if (req.user.role === 'client' && project.clientId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ message: 'Server error fetching project' });
  }
});

// PATCH /api/projects/:id
router.patch('/:id', requireRole('admin', 'pm'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (req.user.role === 'pm' && project.managerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name, description, status, startDate, endDate } = req.body;
    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;
    if (status !== undefined) project.status = status;
    if (startDate !== undefined) project.startDate = startDate;
    if (endDate !== undefined) project.endDate = endDate;

    await project.save();
    res.json(project);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ message: 'Server error updating project' });
  }
});

module.exports = router;
