const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const ClientProfile = require('../models/ClientProfile');
const ProjectManagerProfile = require('../models/ProjectManagerProfile');
const Project = require('../models/Project');
const Ticket = require('../models/Ticket');
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
      // Client creation requires an initial project, which in turn requires a PM.
      // Note: managerId here is the PM for this client's FIRST project — there is
      // no longer a single "client manager"; each project has its own PM.
      if (!managerId) {
        // Rollback user creation
        await User.findByIdAndDelete(newUser._id);
        return res.status(400).json({ message: 'A Project Manager must be assigned to the initial project' });
      }

      // Verify the PM exists and is active
      const pm = await User.findOne({ _id: managerId, role: 'pm', status: 'active' });
      if (!pm) {
        await User.findByIdAndDelete(newUser._id);
        return res.status(400).json({ message: 'Selected Project Manager not found or inactive' });
      }

      // Create the client's first project
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
        projectIds: [project._id]
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
      // A client can have multiple projects, each with its own PM.
      profile = await ClientProfile.findOne({ userId: user._id })
        .populate({
          path: 'projectIds',
          select: 'name description status managerId',
          populate: { path: 'managerId', select: 'name email' }
        });
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

// POST /api/users/:id/projects — Add a new project to an existing client (Admin only)
router.post('/:id/projects', requireRole('admin'), async (req, res) => {
  try {
    const { projectName, projectDescription, managerId } = req.body;

    if (!projectName) {
      return res.status(400).json({ message: 'Project name is required' });
    }
    if (!managerId) {
      return res.status(400).json({ message: 'A Project Manager must be assigned to this project' });
    }

    const client = await User.findOne({ _id: req.params.id, role: 'client' });
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const clientProfile = await ClientProfile.findOne({ userId: client._id });
    if (!clientProfile) {
      return res.status(404).json({ message: 'Client profile not found' });
    }

    const pm = await User.findOne({ _id: managerId, role: 'pm', status: 'active' });
    if (!pm) {
      return res.status(400).json({ message: 'Selected Project Manager not found or inactive' });
    }

    const project = await Project.create({
      clientId: client._id,
      managerId: managerId,
      name: projectName,
      description: projectDescription || '',
      status: 'active'
    });

    clientProfile.projectIds.push(project._id);
    await clientProfile.save();

    await AuditLog.create({
      userId: req.user._id,
      action: 'project_added',
      entityType: 'Project',
      entityId: project._id,
      newValue: { clientId: client._id, name: project.name, managerId }
    });

    const populatedProject = await Project.findById(project._id).populate('managerId', 'name email');

    res.status(201).json({ message: 'Project added successfully', project: populatedProject });
  } catch (error) {
    console.error('Add project error:', error);
    res.status(500).json({ message: 'Server error adding project' });
  }
});

// PATCH /api/users/:id/projects/:projectId — Update a client's project (Admin only)
router.patch('/:id/projects/:projectId', requireRole('admin'), async (req, res) => {
  try {
    const { projectName, projectDescription, status } = req.body;

    const client = await User.findOne({ _id: req.params.id, role: 'client' });
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const clientProfile = await ClientProfile.findOne({ userId: client._id });
    const belongsToClient = clientProfile && clientProfile.projectIds.some(
      (pid) => pid.toString() === req.params.projectId
    );
    if (!belongsToClient) {
      return res.status(404).json({ message: 'Project not found for this client' });
    }

    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (status && !['active', 'completed', 'on-hold'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const oldValue = { name: project.name, description: project.description, status: project.status };

    if (projectName !== undefined) project.name = projectName;
    if (projectDescription !== undefined) project.description = projectDescription;
    if (status !== undefined) project.status = status;

    await project.save();

    await AuditLog.create({
      userId: req.user._id,
      action: 'project_updated',
      entityType: 'Project',
      entityId: project._id,
      oldValue,
      newValue: { name: project.name, description: project.description, status: project.status }
    });

    const populated = await Project.findById(project._id).populate('managerId', 'name email');
    res.json({ message: 'Project updated successfully', project: populated });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ message: 'Server error updating project' });
  }
});

// DELETE /api/users/:id/projects/:projectId — Remove a project from a client (Admin only).
// Blocked if any tickets still reference this project (would orphan ticket data),
// and blocked from removing a client's last remaining project, since ticket
// creation requires a project to exist.
router.delete('/:id/projects/:projectId', requireRole('admin'), async (req, res) => {
  try {
    const client = await User.findOne({ _id: req.params.id, role: 'client' });
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const clientProfile = await ClientProfile.findOne({ userId: client._id });
    const belongsToClient = clientProfile && clientProfile.projectIds.some(
      (pid) => pid.toString() === req.params.projectId
    );
    if (!belongsToClient) {
      return res.status(404).json({ message: 'Project not found for this client' });
    }

    const ticketCount = await Ticket.countDocuments({ projectId: req.params.projectId });
    if (ticketCount > 0) {
      return res.status(400).json({ message: `Cannot remove project: ${ticketCount} ticket(s) still reference it` });
    }

    if (clientProfile.projectIds.length <= 1) {
      return res.status(400).json({ message: 'A client must have at least one project' });
    }

    await Project.findByIdAndDelete(req.params.projectId);
    clientProfile.projectIds = clientProfile.projectIds.filter(
      (pid) => pid.toString() !== req.params.projectId
    );
    await clientProfile.save();

    await AuditLog.create({
      userId: req.user._id,
      action: 'project_removed',
      entityType: 'Project',
      entityId: req.params.projectId,
      oldValue: { clientId: client._id }
    });

    res.json({ message: 'Project removed successfully' });
  } catch (error) {
    console.error('Remove project error:', error);
    res.status(500).json({ message: 'Server error removing project' });
  }
});

// PATCH /api/users/:id/manager — Reassign employee's PM, or a client's PROJECT's PM (Admin only)
// For clients, req.body must include projectId identifying which of the client's
// projects is being reassigned, since each project can have a different PM.
router.patch('/:id/manager', requireRole('admin'), async (req, res) => {
  try {
    const { managerId, projectId } = req.body;
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
      if (!projectId) {
        return res.status(400).json({ message: 'Project ID is required to reassign a manager for a client (each project has its own PM)' });
      }

      const clientProfile = await ClientProfile.findOne({ userId: user._id });
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

      const oldManagerId = project.managerId;
      project.managerId = managerId;
      await project.save();

      await AuditLog.create({
        userId: req.user._id,
        action: 'client_pm_reassigned',
        entityType: 'Project',
        entityId: project._id,
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