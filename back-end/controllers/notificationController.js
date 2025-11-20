// backend/controllers/notificationController.js
const asyncHandler = require('express-async-handler');
const { Notification } = require('../models/schema');

// @desc    Get my notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20);
  res.json(notifications);
});

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id
// @access  Private
const markRead = asyncHandler(async (req, res) => {
  const notif = await Notification.findById(req.params.id);
  if (notif && notif.user.toString() === req.user._id.toString()) {
    notif.isRead = true;
    await notif.save();
    res.json({ success: true });
  } else {
    res.status(404); throw new Error('Notification not found');
  }
});

module.exports = { getNotifications, markRead };