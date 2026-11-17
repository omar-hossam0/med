const express = require("express");
const notificationController = require("../controllers/notificationController");
const { requireAuth } = require("../middleware/auth");
const { verifyCsrf } = require("../middleware/csrf");

const router = express.Router();

router.use(requireAuth);

router.get("/unread-count", notificationController.unreadCount);
router.get("/", notificationController.list);
router.patch("/:id/read", verifyCsrf, notificationController.markRead);

module.exports = router;
