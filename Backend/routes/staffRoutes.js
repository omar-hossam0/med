const express = require("express");
const staffController = require("../controllers/staffController");
const { requireAuth, requireRole, requirePermission } = require("../middleware/auth");
const { verifyCsrf } = require("../middleware/csrf");
const { clinicalMutationLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// The two status transitions that a doctor may perform are mounted with a
// wider role guard; every other staff endpoint is receptionist-only (§8).
const staff = [requireAuth, requireRole("receptionist", "staff"), requirePermission("appointments.manage")];
const staffOrDoctor = [requireAuth, requireRole("receptionist", "staff", "doctor")];
const mutate = [clinicalMutationLimiter, verifyCsrf];

router.get("/me", ...staff, staffController.getMe);
router.get("/dashboard", ...staff, staffController.getDashboard);
router.get("/patients/:id", ...staff, staffController.getPatient);

router.get("/appointments", ...staff, staffController.listAppointments);
router.get("/appointments/:id", ...staff, staffController.getAppointment);
router.patch("/appointments/:id/schedule", ...staff, ...mutate, staffController.scheduleAppointment);
router.post("/appointments/:id/confirm", ...staff, ...mutate, staffController.confirmAppointment);
router.post("/appointments/:id/check-in", ...staff, ...mutate, staffController.checkInAppointment);
router.post("/appointments/:id/start", ...staffOrDoctor, ...mutate, staffController.startAppointment);
router.post("/appointments/:id/complete", ...staffOrDoctor, ...mutate, staffController.completeAppointment);
router.post("/appointments/:id/no-show", ...staff, ...mutate, staffController.noShowAppointment);
router.patch("/appointments/:id/notes", ...staff, ...mutate, staffController.updateAppointmentNotes);

router.post("/appointment-proposals/:id/book", ...staff, ...mutate, staffController.bookProposal);

module.exports = router;
