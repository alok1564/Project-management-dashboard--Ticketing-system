const express = require('express');
const User = require('../models/User');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(requireRole('pm', 'admin'));

router.get('/', async (req, res) => {
  try {
    const query = {};
    // Support filtering by role
    if (req.query.role) {
      query.role = req.query.role;
    }
    const users = await User.find(query, '_id name email role').sort({ role: 1, name: 1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching users' });
  }
});

module.exports = router;
