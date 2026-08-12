const mongoose = require('mongoose');
const dns = require('dns');

// Force Node.js to use Google DNS (fixes SRV lookup issues on Windows)
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/ticketing';
    await mongoose.connect(uri, {
      family: 4,  // Force IPv4 (avoids IPv6 issues on Windows)
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
