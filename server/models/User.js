const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['client', 'employee', 'pm', 'admin'], 
    required: true 
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  mustChangePassword: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Never return password in JSON
userSchema.methods.toSafeJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ createdBy: 1 });

module.exports = mongoose.model('User', userSchema);
