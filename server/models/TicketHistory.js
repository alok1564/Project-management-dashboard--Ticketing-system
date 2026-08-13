const mongoose = require('mongoose');

const ticketHistorySchema = new mongoose.Schema({
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  action: {
    type: String,
    required: true,
    enum: ['created', 'assigned', 'unassigned', 'status_changed', 'priority_changed', 'reopened', 'commented', 'closed']
  },
  oldValue: { type: String, default: null },
  newValue: { type: String, default: null },
  timestamp: { type: Date, default: Date.now }
});

ticketHistorySchema.index({ ticketId: 1, timestamp: 1 });

module.exports = mongoose.model('TicketHistory', ticketHistorySchema);
