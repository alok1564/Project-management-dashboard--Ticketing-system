const express = require('express');
const AuditLog = require('../models/AuditLog');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(requireRole('admin'));

// GET /api/audit-logs
router.get('/', async (req, res) => {
  try {
    const { action, entityType, page = 1, limit = 50 } = req.query;
    const query = {};

    if (action) query.action = action;
    if (entityType) query.entityType = entityType;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .populate('userId', 'name email role')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('List audit logs error:', error);
    res.status(500).json({ message: 'Server error fetching audit logs' });
  }
});

module.exports = router;
