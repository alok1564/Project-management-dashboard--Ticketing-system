const mongoose = require('mongoose');

const clientProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  companyName: { type: String, default: '' },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

clientProfileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

clientProfileSchema.index({ managerId: 1 });

module.exports = mongoose.model('ClientProfile', clientProfileSchema);
