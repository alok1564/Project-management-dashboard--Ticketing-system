const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  isReopen: { type: Boolean, default: false }, // true when this comment is the one that reopened a closed ticket
  isActivity: { type: Boolean, default: false }, // true for system-generated activity entries (assign/close/auto-transition), rendered as a lightweight event line instead of a full comment card
  isSystem: { type: Boolean, default: false }, // true only for fully automatic events with no actor (e.g. the 30-min auto In Progress transition) — rendered without an author-name prefix
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Comment', commentSchema);