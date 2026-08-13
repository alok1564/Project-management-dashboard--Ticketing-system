const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const ClientProfile = require('../models/ClientProfile');
const ProjectManagerProfile = require('../models/ProjectManagerProfile');
const Project = require('../models/Project');
const AuditLog = require('../models/AuditLog');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// GET /api/users — List users with filtering, search, and pagination
router.get('/', requireRole('admin', 'pm'), async (req, res) => {
  try {
    const { role, status, search, page = 1, limit = 50 } = req.query;
    const query = {};

    if (role) query.role = role;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // PM can only see employees that belong to them
    if (req.user.role === 'pm') {
      const empProfiles = await EmployeeProfile.find({ managerId: req.user._id }).select('userId');
      const empIds = empProfiles.map(p => p.userId);
      query._id = { $in: empIds };
      query.role = 'employee';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.countDocuments(query);
    const users = await User.find(query, '-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
});

// POST /api/users — Create user
// Admin can create: pm, client, employee
// PM can create: employee only (auto-assigned to that PM)
router.post('/', requireRole('admin', 'pm'), async (req, res) => {
  try {
    const { name, email, password, role, phone, designation, department, companyName, address, managerId, projectName, projectDescription } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Role enforcement
    let userRole = role;
    if (req.user.role === 'pm') {
      // PM can only create employees
      userRole = 'employee';
    } else if (req.user.role === 'admin') {
      if (!role || !['pm', 'client', 'employee'].includes(role)) {
        return res.status(400).json({ message: 'Valid role (pm, client, employee) is required' });
      }
    }

    // Check duplicate email
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: userRole,
      status: 'active',
      mustChangePassword: true,
      createdBy: req.user._id
    });
    await newUser.save();

    // Create role-specific profile
    if (userRole === 'employee') {
      const empManagerId = req.user.role === 'pm' ? req.user._id : (managerId || null);
      await EmployeeProfile.create({
        userId: newUser._id,
        managerId: empManagerId,
        designation: designation || '',
        department: department || '',
        phone: phone || ''
      });
    } else if (userRole === 'pm') {
      await ProjectManagerProfile.create({
        userId: newUser._id,
        phone: phone || '',
        department: department || '',
        designation: designation || ''
      });
    } else if (userRole === 'client') {
      // Client requires a PM assignment
      if (!managerId) {
        // Rollback user creation
        await User.findByIdAndDelete(newUser._id);
        return res.status(400).json({ message: 'A Project Manager must be assigned to the client' });
      }

      // Verify the PM exists and is active
      const pm = await User.findOne({ _id: managerId, role: 'pm', status: 'active' });
      if (!pm) {
        await User.findByIdAndDelete(newUser._id);
        return res.status(400).json({ message: 'Selected Project Manager not found or inactive' });
      }

      // Create project for the client
      const project = await Project.create({
        clientId: newUser._id,
        managerId: managerId,
        name: projectName || `${name} Project`,
        description: projectDescription || '',
        status: 'active'
      });

      await ClientProfile.create({
        userId: newUser._id,
        companyName: companyName || '',
        phone: phone || '',
        address: address || '',
        managerId: managerId,
        projectId: project._id
      });
    }

    // Audit log
    await AuditLog.create({
      userId: req.user._id,
      action: 'user_created',
      entityType: 'User',
      entityId: newUser._id,
      newValue: { name: newUser.name, email: newUser.email, role: userRole }
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Server error creating user' });
  }
});

// GET /api/users/:id — Get user details with profile
router.get('/:id', requireRole('admin', 'pm'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id, '-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // PM can only view their employees
    if (req.user.role === 'pm') {
      const empProfile = await EmployeeProfile.findOne({ userId: user._id, managerId: req.user._id });
      if (!empProfile) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    let profile = null;
    if (user.role === 'employee') {
      profile = await EmployeeProfile.findOne({ userId: user._id }).populate('managerId', 'name email');
    } else if (user.role === 'client') {
      profile = await ClientProfile.findOne({ userId: user._id })
        .populate('managerId', 'name email')
        .populate('projectId', 'name status');
    } else if (user.role === 'pm') {
      profile = await ProjectManagerProfile.findOne({ userId: user._id });
    }

    const createdByUser = user.createdBy ? await User.findById(user.createdBy, 'name email role') : null;

    res.json({ user, profile, createdBy: createdByUser });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error fetching user' });
  }
});

// PATCH /api/users/:id/status — Activate/deactivate user
router.patch('/:id/status', requireRole('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Status must be active or inactive' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deactivating yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot change your own status' });
    }

    const oldStatus = user.status;
    user.status = status;
    await user.save();

    await AuditLog.create({
      userId: req.user._id,
      action: status === 'active' ? 'user_activated' : 'user_deactivated',
      entityType: 'User',
      entityId: user._id,
      oldValue: { status: oldStatus },
      newValue: { status }
    });

    res.json({ message: `User ${status === 'active' ? 'activated' : 'deactivated'} successfully`, user: { id: user._id, name: user.name, status: user.status } });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Server error updating user status' });
  }
});

// PATCH /api/users/:id/manager — Reassign employee or client to different PM (Admin only)
router.patch('/:id/manager', requireRole('admin'), async (req, res) => {
  try {
    const { managerId } = req.body;
    if (!managerId) {
      return res.status(400).json({ message: 'Manager ID is required' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const newPM = await User.findOne({ _id: managerId, role: 'pm', status: 'active' });
    if (!newPM) {
      return res.status(400).json({ message: 'Selected Project Manager not found or inactive' });
    }

    if (user.role === 'employee') {
      const profile = await EmployeeProfile.findOne({ userId: user._id });
      if (!profile) {
        return res.status(404).json({ message: 'Employee profile not found' });
      }
      const oldManagerId = profile.managerId;
      profile.managerId = managerId;
      await profile.save();

      await AuditLog.create({
        userId: req.user._id,
        action: 'employee_reassigned',
        entityType: 'User',
        entityId: user._id,
        oldValue: { managerId: oldManagerId },
        newValue: { managerId }
      });
    } else if (user.role === 'client') {
      const profile = await ClientProfile.findOne({ userId: user._id });
      if (!profile) {
        return res.status(404).json({ message: 'Client profile not found' });
      }
      const oldManagerId = profile.managerId;
      profile.managerId = managerId;
      await profile.save();

      // Also update the project's managerId
      if (profile.projectId) {
        await Project.findByIdAndUpdate(profile.projectId, { managerId });
      }

      await AuditLog.create({
        userId: req.user._id,
        action: 'client_pm_reassigned',
        entityType: 'User',
        entityId: user._id,
        oldValue: { managerId: oldManagerId },
        newValue: { managerId }
      });
    } else {
      return res.status(400).json({ message: 'Only employees and clients can be reassigned' });
    }

    res.json({ message: 'Manager reassigned successfully' });
  } catch (error) {
    console.error('Reassign manager error:', error);
    res.status(500).json({ message: 'Server error reassigning manager' });
  }
});

module.exports = router;
