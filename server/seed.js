require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Ticket = require('./models/Ticket');
const Comment = require('./models/Comment');
const connectDB = require('./db/connection');

const seedDB = async () => {
  try {
    await connectDB();

    console.log('Dropping collections...');
    await User.deleteMany({});
    await Ticket.deleteMany({});
    await Comment.deleteMany({});

    console.log('Creating users...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password', salt);

    const users = await User.insertMany([
      { name: 'Alice Admin', email: 'alice@demo.com', role: 'admin', password: hashedPassword },
      { name: 'Pete Manager', email: 'pete@demo.com', role: 'pm', password: hashedPassword },
      { name: 'Eve Engineer', email: 'eve@demo.com', role: 'employee', password: hashedPassword },
      { name: 'Dan Developer', email: 'dan@demo.com', role: 'employee', password: hashedPassword },
      { name: 'Charlie Client', email: 'charlie@demo.com', role: 'client', password: hashedPassword }
    ]);

    const admin = users[0];
    const pm = users[1];
    const eve = users[2];
    const dan = users[3];
    const charlie = users[4];

    console.log('Creating tickets...');
    const now = Date.now();
    const tickets = await Ticket.insertMany([
      {
        title: 'Login page not responsive',
        description: 'The login page fails to load on mobile devices.',
        status: 'New',
        priority: 'High',
        requester: charlie._id,
        lastActivity: new Date(now - 60 * 60 * 1000) // 1 hour ago
      },
      {
        title: 'Dashboard loading slowly',
        description: 'It takes 10 seconds to load the dashboard.',
        status: 'Assigned',
        assignee: eve._id,
        priority: 'Medium',
        requester: charlie._id,
        lastActivity: new Date(now - 30 * 60 * 1000) // 30 min ago
      },
      {
        title: 'Update user profile API',
        description: 'Need a new endpoint to update user profiles.',
        status: 'In Progress',
        assignee: dan._id,
        priority: 'Low',
        requester: charlie._id,
        lastActivity: new Date(now - 10 * 60 * 1000) // 10 min ago
      }
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
