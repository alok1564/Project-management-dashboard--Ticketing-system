const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  isReopen: { type: Boolean, default: false }, // true when this comment is the one that reopened a closed ticket
  isActivity: { type: Boolean, default: false }, // true for system-generated activity entries (assign/start/close), rendered as a lightweight event line instead of a full comment card
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Comment', commentSchema);