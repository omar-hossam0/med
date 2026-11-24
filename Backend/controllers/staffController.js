/** Thin HTTP layer for /api/staff/*. */
const { handler } = require("../utils/controllerHelpers");
const staffService = require("../services/staffService");
const schedulingService = require("../services/schedulingService");
const followUpService = require("../services/followUpService");

module.exports = {
  getMe: handler(staffService.getMe),
  getDashboard: handler(staffService.getDashboard),
  getPatient: handler(staffService.getPatient),

  listAppointments: handler(schedulingService.listStaffAppointments),
  getAppointment: handler(schedulingService.getStaffAppointment),
  scheduleAppointment: handler(schedulingService.staffSchedule),
  confirmAppointment: handler(schedulingService.staffConfirm),
  checkInAppointment: handler(schedulingService.staffCheckIn),
  startAppointment: handler(schedulingService.staffStart),
  completeAppointment: handler(schedulingService.staffComplete),
  noShowAppointment: handler(schedulingService.staffNoShow),
  updateAppointmentNotes: handler(schedulingService.staffNotes),

  bookProposal: handler(followUpService.bookProposal, 201),
};
