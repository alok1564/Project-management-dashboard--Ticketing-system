const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['New', 'Assigned', 'In Progress', 'Closed', 'Reopened'], 
    default: 'New' 
  },
  priority: { 
    type: String, 
    enum: ['P1', 'P2', 'P3', 'P4'], 
    default: 'P3' 
  },
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedAt: { type: Date, default: null },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  createdAt: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now }
});

ticketSchema.index({ status: 1 });
ticketSchema.index({ assignee: 1 });
ticketSchema.index({ requester: 1 });
ticketSchema.index({ lastActivity: -1 });
ticketSchema.index({ managerId: 1 });
ticketSchema.index({ projectId: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);