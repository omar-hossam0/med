const express = require("express");
const adminUsersController = require("../controllers/adminUsersController");
const adminDirectoryController = require("../controllers/adminDirectoryController");
const adminReferenceController = require("../controllers/adminReferenceController");
const {
  requireAuth,
  requireRole,
  requirePermission,
  requireAnyPermission,
} = require("../middleware/auth");
const { verifyCsrf } = require("../middleware/csrf");
const { adminActionLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// Every route below is admin-only. Role is not enough on its own: each route
// also requires the specific staff_accounts/users permission, and every
// mutation is CSRF-checked against the session-bound token.
router.use(requireAuth, requireRole("admin"));

/* ------------------------------- users ---------------------------------- */

router.get(
  "/users",
  requireAnyPermission("users.manage", "staff_accounts.view"),
  adminUsersController.list
);

router.get(
  "/users/:id",
  requireAnyPermission("users.manage", "staff_accounts.view"),
  adminUsersController.detail
);

router.post(
  "/users",
  requirePermission("staff_accounts.create"),
  adminActionLimiter,
  verifyCsrf,
  adminUsersController.create
);

router.patch(
  "/users/:id",
  requirePermission("staff_accounts.update"),
  adminActionLimiter,
  verifyCsrf,
  adminUsersController.update
);

router.patch(
  "/users/:id/status",
  requirePermission("staff_accounts.disable"),
  adminActionLimiter,
  verifyCsrf,
  adminUsersController.updateStatus
);

router.post(
  "/users/:id/invitations",
  requirePermission("staff_accounts.invite"),
  adminActionLimiter,
  verifyCsrf,
  adminUsersController.invite
);

/* ---------------------------- doctors & staff --------------------------- */

router.get(
  "/doctors-staff",
  requirePermission("staff_accounts.view"),
  adminDirectoryController.list
);

router.get(
  "/doctors-staff/:id",
  requirePermission("staff_accounts.view"),
  adminDirectoryController.detail
);

router.patch(
  "/doctors-staff/:id",
  requirePermission("staff_accounts.update"),
  adminActionLimiter,
  verifyCsrf,
  adminDirectoryController.update
);

router.post(
  "/doctors-staff/:id/verification",
  requirePermission("staff_accounts.update"),
  adminActionLimiter,
  verifyCsrf,
  adminDirectoryController.verify
);

/* ----------------------------- reference data --------------------------- */

router.get(
  "/reference-data",
  requirePermission("staff_accounts.view"),
  adminReferenceController.get
);

module.exports = router;
