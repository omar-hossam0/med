/** Thin HTTP layer for /api/notifications/*. */
const { handler } = require("../utils/controllerHelpers");
const notificationService = require("../services/notificationService");

module.exports = {
  list: handler(notificationService.listNotifications),
  unreadCount: handler(notificationService.getUnreadCount),
  markRead: handler(notificationService.markRead),
};
