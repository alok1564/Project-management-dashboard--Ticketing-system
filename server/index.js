require('dotenv').config();
const express = require('express');
const cors = require('cors');
const dns = require("dns");

dns.setServers([
  "8.8.8.8",
  "8.8.4.4"
]);
const connectDB = require('./db/connection');

const authRoutes = require('./routes/auth');
const ticketRoutes = require('./routes/tickets');
const userRoutes = require('./routes/users');
const clientRoutes = require('./routes/clients');
const projectRoutes = require('./routes/projects');
const auditLogRoutes = require('./routes/audit-logs');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
const allowedOrigins = [
  'http://localhost:5176',
  'http://localhost:5173'
];

app.use(cors({
  origin: allowedOrigins
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/audit-logs', auditLogRoutes);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
