require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const EmployeeProfile = require('./models/EmployeeProfile');
const ClientProfile = require('./models/ClientProfile');
const ProjectManagerProfile = require('./models/ProjectManagerProfile');
const Project = require('./models/Project');
const Ticket = require('./models/Ticket');
const connectDB = require('./db/connection');

const migrate = async () => {
  try {
    await connectDB();
    console.log('Starting migration...');

    // 1. Add status and mustChangePassword to all existing users that don't have them
    const usersWithoutStatus = await User.find({ status: { $exists: false } });
    for (const user of usersWithoutStatus) {
      user.status = 'active';
      user.mustChangePassword = false;
      user.updatedAt = Date.now();
      await user.save();
    }
    console.log(`Updated ${usersWithoutStatus.length} users with status field`);

    // Also update users that have status but it might be null
    await User.updateMany(
      { status: null },
      { $set: { status: 'active', mustChangePassword: false, updatedAt: Date.now() } }
    );

    // 2. Create profiles for existing users who don't have them
    const allUsers = await User.find();
    let profilesCreated = 0;

    for (const user of allUsers) {
      if (user.role === 'employee') {
        const existing = await EmployeeProfile.findOne({ userId: user._id });
        if (!existing) {
          await EmployeeProfile.create({ userId: user._id });
          profilesCreated++;
        }
      } else if (user.role === 'client') {
        const existing = await ClientProfile.findOne({ userId: user._id });
        if (!existing) {
          // Create a default project
          const existingProject = await Project.findOne({ clientId: user._id });
          let project = existingProject;
          if (!project) {
            project = await Project.create({
              clientId: user._id,
              managerId: user._id, // placeholder — admin must assign real PM
              name: `${user.name} Project`,
              status: 'active'
            });
          }
          await ClientProfile.create({
            userId: user._id,
            projectId: project._id
          });
          profilesCreated++;
        }
      } else if (user.role === 'pm') {
        const existing = await ProjectManagerProfile.findOne({ userId: user._id });
        if (!existing) {
          await ProjectManagerProfile.create({ userId: user._id });
          profilesCreated++;
        }
      }
    }
    console.log(`Created ${profilesCreated} missing profiles`);

    // 3. Backfill managerId and projectId on existing tickets
    const ticketsWithoutManager = await Ticket.find({ managerId: { $in: [null, undefined] } });
    let ticketsUpdated = 0;
    for (const ticket of ticketsWithoutManager) {
      const clientProfile = await ClientProfile.findOne({ userId: ticket.requester });
      if (clientProfile) {
        ticket.managerId = clientProfile.managerId || null;
        ticket.projectId = clientProfile.projectId || null;
        await ticket.save();
        ticketsUpdated++;
      }
    }
    console.log(`Backfilled ${ticketsUpdated} tickets with managerId/projectId`);

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
};

migrate();
