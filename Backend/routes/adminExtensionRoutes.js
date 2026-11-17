const express = require("express");
const adminExtensionController = require("../controllers/adminExtensionController");
const { requireAuth, requireRole } = require("../middleware/auth");
const { verifyCsrf } = require("../middleware/csrf");
const { adminActionLimiter } = require("../middleware/rateLimiter");

// Mounted at /api/admin AFTER the existing adminRoutes. Express falls through
// from that router when none of its routes match, so both routers coexist
// without touching the implemented baseline endpoints.
const router = express.Router();

router.use(requireAuth, requireRole("admin"));

const mutate = [adminActionLimiter, verifyCsrf];

router.get("/dashboard", adminExtensionController.getDashboard);

router.get("/ai/reports", adminExtensionController.getAiReports);
router.get("/ai/summary", adminExtensionController.getAiSummary);
router.get("/ai/daily-series", adminExtensionController.getAiDailySeries);
router.get("/ai/doctors/ranking", adminExtensionController.getAiDoctorRanking);
router.get("/ai/health", adminExtensionController.getAiHealth);
router.get("/ai/activities", adminExtensionController.getAiActivities);
router.get("/ai/reports/:id/events", adminExtensionController.getAiReportEvents);

router.get("/departments", adminExtensionController.listDepartments);
router.post("/departments", ...mutate, adminExtensionController.createDepartment);
router.patch("/departments/:id", ...mutate, adminExtensionController.updateDepartment);
router.put("/departments/:id/doctors", ...mutate, adminExtensionController.setDepartmentDoctors);
router.put("/departments/:id/services", ...mutate, adminExtensionController.setDepartmentServices);

module.exports = router;
