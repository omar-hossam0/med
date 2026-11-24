const express = require("express");
const patientController = require("../controllers/patientController");
const { requireAuth, requireRole, requirePermission } = require("../middleware/auth");
const { verifyCsrf } = require("../middleware/csrf");
const { clinicalReadLimiter, clinicalMutationLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// Every patient endpoint requires a session and the patient role. Record-level
// ownership is re-checked inside each service; no endpoint accepts a
// patient_user_id from the client.
router.use(requireAuth, requireRole("patient"));

const readClinical = [clinicalReadLimiter];
const mutate = [clinicalMutationLimiter, verifyCsrf];

/* ---------------------- profile, doctors, dashboard ---------------------- */

router.get("/profile", patientController.getProfile);
router.patch("/profile", mutate, patientController.updateProfile);
router.get("/doctors", patientController.listDoctors);
router.get("/doctors/:id", clinicalReadLimiter, patientController.getDoctor);
router.get("/departments", patientController.listDepartments);
router.get("/dashboard", patientController.getDashboard);

/* --------------------------- scheduling --------------------------------- */

router.get("/availability/slots", patientController.getSlots);
router.get("/appointments", requirePermission("appointments.view_own"), patientController.listAppointments);
router.get("/appointments/:id", patientController.getAppointment);
router.get("/appointments/:id/timeline", patientController.getAppointmentTimeline);
router.post("/appointments", requirePermission("appointments.create"), mutate, patientController.createAppointment);
router.post("/appointments/:id/reschedule", mutate, patientController.rescheduleAppointment);
router.post("/appointments/:id/cancel", mutate, patientController.cancelAppointment);

/* ------------------------ clinical portal ------------------------------- */

router.get("/medical-records", readClinical, patientController.getMedicalRecordFeed);
router.get("/medical-records/:type/:id", readClinical, patientController.getRecordDetail);
router.get("/lab-results", readClinical, patientController.listLabResults);
router.get("/lab-results/:id", readClinical, patientController.getLabResult);
router.get("/prescriptions", readClinical, patientController.listPrescriptions);
router.get("/prescriptions/:id", readClinical, patientController.getPrescription);
router.get("/medications", readClinical, patientController.getMedications);

router.get("/reports", requirePermission("reports.view_own"), readClinical, patientController.listReports);
router.get("/reports/:id", readClinical, patientController.getReport);
router.get("/transcripts/:id", readClinical, patientController.getTranscript);

/* ------------------------- follow-ups ----------------------------------- */

router.get("/follow-ups", patientController.listFollowUps);
router.post("/appointment-proposals/:id/select", mutate, patientController.selectProposal);

module.exports = router;
