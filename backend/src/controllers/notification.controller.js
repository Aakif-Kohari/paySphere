const Notification = require("../models/notification.model");

// Get notifications for the logged-in user
const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user._id;
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });

    res.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

// Mark a specific notification as read
const markAsRead = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user._id;
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    res.json({ success: true, notification });
  } catch (error) {
    next(error);
  }
};

// Mark all notifications as read for the user
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user._id;
    await Notification.updateMany({ userId, isRead: false }, { isRead: true });

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
};