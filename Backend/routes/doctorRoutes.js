const express = require("express");
const doctorController = require("../controllers/doctorController");
const { requireAuth, requireRole, requirePermission } = require("../middleware/auth");
const { verifyCsrf } = require("../middleware/csrf");
const { clinicalReadLimiter, clinicalMutationLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.use(requireAuth, requireRole("doctor"));

const readClinical = [clinicalReadLimiter];
const mutate = [clinicalMutationLimiter, verifyCsrf];

/* --------------------------- own workspace ------------------------------ */

router.get("/me", doctorController.getMe);
router.patch("/me", mutate, doctorController.updateMe);
router.get("/availability", doctorController.getAvailability);
router.post("/availability", mutate, doctorController.createAvailability);
router.patch("/availability/:id", mutate, doctorController.updateAvailability);
router.post("/time-off", mutate, doctorController.createTimeOff);
router.delete("/time-off/:id", mutate, doctorController.cancelTimeOff);

/* ---------------------------- appointments ------------------------------ */

router.get("/appointments", requirePermission("appointments.view_own"), doctorController.listAppointments);
router.post("/appointments/:id/start", mutate, doctorController.startAppointment);
router.post("/appointments/:id/complete", mutate, doctorController.completeAppointment);

/* --------------------------- consultations ------------------------------ */

router.get("/consultations", doctorController.listConsultations);
router.get("/consultations/:id", readClinical, doctorController.getConsultation);
router.post("/consultations/:id/start", mutate, doctorController.startConsultation);
router.post("/consultations/:id/complete", mutate, doctorController.completeConsultation);
router.post("/consultations/:id/consents", mutate, doctorController.createConsent);
router.post("/consultations/:id/consents/:consentId/revoke", mutate, doctorController.revokeConsent);
router.post("/consultations/:id/recordings", mutate, doctorController.registerRecording);
router.patch("/consultations/:id/recordings/:recordingId", mutate, doctorController.updateRecording);

/* ---------------------------- transcripts ------------------------------- */

router.get("/consultations/:id/transcripts", readClinical, doctorController.listConsultationTranscripts);
router.get("/transcripts/:id", readClinical, doctorController.getTranscript);
router.post("/transcripts", mutate, doctorController.createTranscript);
router.post("/transcripts/:id/versions", mutate, doctorController.createTranscriptVersion);
router.post(
  "/transcript-versions/:id/review",
  requirePermission("transcripts.approve"),
  mutate,
  doctorController.reviewTranscriptVersion
);

/* ------------------------------ reports --------------------------------- */

router.get("/consultations/:id/reports", readClinical, doctorController.listConsultationReports);
router.get("/reports/:id", readClinical, doctorController.getReport);
router.get("/reports/:id/versions/:versionId", readClinical, doctorController.getReportVersion);
router.post("/reports/:id/versions", mutate, doctorController.createReportVersion);
router.post(
  "/report-versions/:id/review",
  requirePermission("reports.approve"),
  mutate,
  doctorController.reviewReportVersion
);
router.post("/reports/:id/publish", mutate, doctorController.publishReport);
router.post("/reports/:id/withdraw", mutate, doctorController.withdrawReport);

/* --------------------- Agent 2 + patient chart -------------------------- */

router.get("/patients/:id/proposals", readClinical, doctorController.listPatientProposals);
router.get("/patients/:id/record", readClinical, doctorController.getDoctorChart);
router.post("/patients/:id/record-entries", mutate, doctorController.createRecordEntry);
router.get("/proposals/:id", readClinical, doctorController.getProposal);
router.post("/proposals/:id/review", mutate, doctorController.reviewProposal);
router.post("/proposals/:id/apply", mutate, doctorController.applyProposal);

/* ------------------------- follow-ups ----------------------------------- */

router.get("/patients/:id/follow-ups", doctorController.listPatientFollowUps);
router.post("/follow-ups/:id/accept", mutate, doctorController.acceptFollowUp);
router.post("/follow-ups/:id/decline", mutate, doctorController.declineFollowUp);
router.post("/follow-ups/:id/proposals", mutate, doctorController.createProposals);

module.exports = router;
