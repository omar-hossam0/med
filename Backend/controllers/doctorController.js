/** Thin HTTP layer for /api/doctor/*. */
const { handler } = require("../utils/controllerHelpers");
const doctorService = require("../services/doctorService");
const schedulingService = require("../services/schedulingService");
const consultationService = require("../services/consultationService");
const clinicalReviewService = require("../services/clinicalReviewService");
const medicalRecordService = require("../services/medicalRecordService");
const followUpService = require("../services/followUpService");

module.exports = {
  getMe: handler(doctorService.getMe),
  updateMe: handler(doctorService.updateMe),
  getAvailability: handler(doctorService.getAvailability),
  createAvailability: handler(doctorService.createAvailability, 201),
  updateAvailability: handler(doctorService.updateAvailability),
  createTimeOff: handler(doctorService.createTimeOff, 201),
  cancelTimeOff: handler(doctorService.cancelTimeOff),

  listAppointments: handler(schedulingService.listDoctorAppointments),
  startAppointment: handler(schedulingService.staffStart),
  completeAppointment: handler(schedulingService.staffComplete),

  listConsultations: handler(consultationService.listConsultations),
  getConsultation: handler(consultationService.getConsultation),
  startConsultation: handler(consultationService.startConsultation),
  completeConsultation: handler(consultationService.completeConsultation),
  createConsent: handler(consultationService.createConsent, 201),
  revokeConsent: handler(consultationService.revokeConsent),
  registerRecording: handler(consultationService.registerRecording, 201),
  updateRecording: handler(consultationService.updateRecording),

  listConsultationTranscripts: handler(clinicalReviewService.listConsultationTranscripts),
  getTranscript: handler(clinicalReviewService.getTranscript),
  createTranscript: handler(clinicalReviewService.createTranscript, 201),
  createTranscriptVersion: handler(clinicalReviewService.createTranscriptVersion, 201),
  reviewTranscriptVersion: handler(clinicalReviewService.reviewTranscriptVersion),

  listConsultationReports: handler(clinicalReviewService.listConsultationReports),
  getReport: handler(clinicalReviewService.getReport),
  getReportVersion: handler(clinicalReviewService.getReportVersion),
  createReportVersion: handler(clinicalReviewService.createReportVersion, 201),
  reviewReportVersion: handler(clinicalReviewService.reviewReportVersion),
  publishReport: handler(clinicalReviewService.publishReport),
  withdrawReport: handler(clinicalReviewService.withdrawReport),

  listPatientProposals: handler(medicalRecordService.listPatientProposals),
  getProposal: handler(medicalRecordService.getProposal),
  reviewProposal: handler(medicalRecordService.reviewProposal),
  applyProposal: handler(medicalRecordService.applyProposal),
  getDoctorChart: handler(medicalRecordService.getDoctorChart),
  createRecordEntry: handler(medicalRecordService.createRecordEntry, 201),

  listPatientFollowUps: handler(followUpService.listDoctorFollowUps),
  acceptFollowUp: handler(followUpService.acceptFollowUp),
  declineFollowUp: handler(followUpService.declineFollowUp),
  createProposals: handler(followUpService.createProposals, 201),
};
