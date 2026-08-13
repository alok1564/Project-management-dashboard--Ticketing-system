const mongoose = require('mongoose');

const employeeProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  designation: { type: String, default: '' },
  department: { type: String, default: '' },
  phone: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

employeeProfileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

employeeProfileSchema.index({ managerId: 1 });

module.exports = mongoose.model('EmployeeProfile', employeeProfileSchema);
