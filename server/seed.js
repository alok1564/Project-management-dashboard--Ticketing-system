require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Ticket = require('./models/Ticket');
const Comment = require('./models/Comment');
const EmployeeProfile = require('./models/EmployeeProfile');
const ClientProfile = require('./models/ClientProfile');
const ProjectManagerProfile = require('./models/ProjectManagerProfile');
const Project = require('./models/Project');
const TicketHistory = require('./models/TicketHistory');
const AuditLog = require('./models/AuditLog');
const connectDB = require('./db/connection');

const seedDB = async () => {
  try {
    await connectDB();

    console.log('Dropping collections...');
    await User.deleteMany({});
    await Ticket.deleteMany({});
    await Comment.deleteMany({});
    await EmployeeProfile.deleteMany({});
    await ClientProfile.deleteMany({});
    await ProjectManagerProfile.deleteMany({});
    await Project.deleteMany({});
    await TicketHistory.deleteMany({});
    await AuditLog.deleteMany({});

    console.log('Creating users...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password', salt);

    const users = await User.insertMany([
      { name: 'Alice Admin', email: 'alice@demo.com', role: 'admin', password: hashedPassword, status: 'active' },
      { name: 'Pete Manager', email: 'pete@demo.com', role: 'pm', password: hashedPassword, status: 'active' },
      { name: 'Eve Engineer', email: 'eve@demo.com', role: 'employee', password: hashedPassword, status: 'active' },
      { name: 'Dan Developer', email: 'dan@demo.com', role: 'employee', password: hashedPassword, status: 'active' },
      { name: 'Charlie Client', email: 'charlie@demo.com', role: 'client', password: hashedPassword, status: 'active' }
    ]);

    const admin = users[0];
    const pm = users[1];
    const eve = users[2];
    const dan = users[3];
    const charlie = users[4];

    console.log('Creating profiles...');
    // PM profile
    await ProjectManagerProfile.create({
      userId: pm._id,
      phone: '9876543210',
      department: 'Engineering',
      designation: 'Senior PM'
    });

    // Employee profiles — both belong to Pete Manager
    await EmployeeProfile.create({
      userId: eve._id,
      managerId: pm._id,
      designation: 'Software Engineer',
      department: 'Engineering',
      phone: '9876543211'
    });

    await EmployeeProfile.create({
      userId: dan._id,
      managerId: pm._id,
      designation: 'Full Stack Developer',
      department: 'Engineering',
      phone: '9876543212'
    });

    // Project for Charlie Client — managed by Pete
    const project = await Project.create({
      clientId: charlie._id,
      managerId: pm._id,
      name: 'Charlie Website',
      description: 'Website development project for Charlie Client',
      status: 'active'
    });

    // Client profile
    await ClientProfile.create({
      userId: charlie._id,
      companyName: 'Charlie Tech',
      phone: '9876543213',
      address: '123 Main St',
      managerId: pm._id,
      projectId: project._id
    });

    console.log('Creating tickets...');
    const now = Date.now();
    const tickets = await Ticket.insertMany([
      {
        title: 'Login page not responsive',
        description: 'The login page fails to load on mobile devices.',
        status: 'New',
        priority: 'P1',
        requester: charlie._id,
        managerId: pm._id,
        projectId: project._id,
        lastActivity: new Date(now - 60 * 60 * 1000)
      },
      {
        title: 'Dashboard loading slowly',
        description: 'It takes 10 seconds to load the dashboard.',
        status: 'Assigned',
        assignee: eve._id,
        assignedBy: pm._id,
        assignedAt: new Date(now - 30 * 60 * 1000),
        priority: 'P2',
        requester: charlie._id,
        managerId: pm._id,
        projectId: project._id,
        lastActivity: new Date(now - 30 * 60 * 1000)
      },
      {
        title: 'Update user profile API',
        description: 'Need a new endpoint to update user profiles.',
        status: 'In Progress',
        assignee: dan._id,
        assignedBy: pm._id,
        assignedAt: new Date(now - 2 * 60 * 60 * 1000),
        priority: 'P3',
        requester: charlie._id,
        managerId: pm._id,
        projectId: project._id,
        lastActivity: new Date(now - 10 * 60 * 1000)
      }
    ]);

    console.log('Creating ticket history...');
    await TicketHistory.insertMany([
      { ticketId: tickets[0]._id, userId: charlie._id, action: 'created', newValue: 'New', timestamp: new Date(now - 60 * 60 * 1000) },
      { ticketId: tickets[1]._id, userId: charlie._id, action: 'created', newValue: 'New', timestamp: new Date(now - 2 * 60 * 60 * 1000) },
      { ticketId: tickets[1]._id, userId: pm._id, action: 'assigned', newValue: 'Eve Engineer', timestamp: new Date(now - 30 * 60 * 1000) },
      { ticketId: tickets[2]._id, userId: charlie._id, action: 'created', newValue: 'New', timestamp: new Date(now - 3 * 60 * 60 * 1000) },
      { ticketId: tickets[2]._id, userId: pm._id, action: 'assigned', newValue: 'Dan Developer', timestamp: new Date(now - 2 * 60 * 60 * 1000) },
      { ticketId: tickets[2]._id, userId: null, action: 'status_changed', oldValue: 'Assigned', newValue: 'In Progress', timestamp: new Date(now - 90 * 60 * 1000) }
    ]);

    console.log('Creating comments...');
    await Comment.insertMany([
      {
        ticket: tickets[1]._id,
        author: pm._id,
        text: 'Assigned to Eve for investigation',
        createdAt: new Date(now - 25 * 60 * 1000)
      },
      {
        ticket: tickets[1]._id,
        author: eve._id,
        text: 'Looking into the database queries',
        createdAt: new Date(now - 20 * 60 * 1000)
      },
      {
        ticket: tickets[2]._id,
        author: pm._id,
        text: 'Dan, please handle this one',
        createdAt: new Date(now - 2 * 60 * 60 * 1000)
      },
      {
        ticket: tickets[2]._id,
        author: dan._id,
        text: 'Working on it, should be done by EOD',
        createdAt: new Date(now - 10 * 60 * 1000)
      }
    ]);

    console.log('Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedDB();
