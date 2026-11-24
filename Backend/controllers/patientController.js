/** Thin HTTP layer for /api/patient/*. All SQL lives in the services. */
const { handler } = require("../utils/controllerHelpers");
const patientService = require("../services/patientService");
const schedulingService = require("../services/schedulingService");
const clinicalReviewService = require("../services/clinicalReviewService");
const patientClinicalService = require("../services/patientClinicalService");
const followUpService = require("../services/followUpService");

module.exports = {
  getProfile: handler(patientService.getProfile),
  updateProfile: handler(patientService.updateProfile),
  listDoctors: handler(patientService.listDoctors),
  getDoctor: handler(patientService.getDoctor),
  listDepartments: handler(patientService.listDepartments),
  getDashboard: handler(patientService.getDashboard),

  getSlots: handler(schedulingService.getSlots),
  listAppointments: handler(schedulingService.listPatientAppointments),
  getAppointment: handler(schedulingService.getPatientAppointment),
  getAppointmentTimeline: handler(schedulingService.getAppointmentTimeline),
  createAppointment: handler(schedulingService.createAppointment, 201),
  rescheduleAppointment: handler(schedulingService.rescheduleAppointment),
  cancelAppointment: handler(schedulingService.cancelAppointment),

  getMedicalRecordFeed: handler(patientClinicalService.getMedicalRecordFeed),
  getRecordDetail: handler(patientClinicalService.getRecordDetail),
  listLabResults: handler(patientClinicalService.listLabResults),
  getLabResult: handler(patientClinicalService.getLabResult),
  listPrescriptions: handler(patientClinicalService.listPrescriptions),
  getPrescription: handler(patientClinicalService.getPrescription),
  getMedications: handler(patientClinicalService.getMedications),

  listReports: handler(clinicalReviewService.listPatientReports),
  getReport: handler(clinicalReviewService.getPatientReport),
  getTranscript: handler(clinicalReviewService.getPatientTranscript),

  listFollowUps: handler(followUpService.listPatientFollowUps),
  selectProposal: handler(followUpService.selectProposal),
};
