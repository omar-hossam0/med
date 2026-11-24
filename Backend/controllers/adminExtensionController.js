/** Thin HTTP layer for the new /api/admin/* operational surfaces. */
const { handler } = require("../utils/controllerHelpers");
const adminDashboardService = require("../services/adminDashboardService");
const adminAiMonitoringService = require("../services/adminAiMonitoringService");
const adminDepartmentsService = require("../services/adminDepartmentsService");

module.exports = {
  getDashboard: handler(adminDashboardService.getDashboard),

  getAiReports: handler(adminAiMonitoringService.getReports),
  getAiSummary: handler(adminAiMonitoringService.getSummary),
  getAiDailySeries: handler(adminAiMonitoringService.getDailySeries),
  getAiDoctorRanking: handler(adminAiMonitoringService.getDoctorRanking),
  getAiHealth: handler(adminAiMonitoringService.getHealth),
  getAiActivities: handler(adminAiMonitoringService.getActivities),
  getAiReportEvents: handler(adminAiMonitoringService.getReportEvents),

  listDepartments: handler(adminDepartmentsService.listDepartments),
  createDepartment: handler(adminDepartmentsService.createDepartment, 201),
  updateDepartment: handler(adminDepartmentsService.updateDepartment),
  setDepartmentDoctors: handler(adminDepartmentsService.setDepartmentDoctors),
  setDepartmentServices: handler(adminDepartmentsService.setDepartmentServices),
};
