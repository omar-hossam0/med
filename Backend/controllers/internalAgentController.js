/** Thin HTTP layer for /api/internal/agents/* (service-token only). */
const { handler } = require("../utils/controllerHelpers");
const agentService = require("../services/agentService");

module.exports = {
  transcription: handler(agentService.transcription, 201),
  reports: handler(agentService.reports, 201),
  profileOrganization: handler(agentService.profileOrganization, 201),
  followUpScheduling: handler(agentService.followUpScheduling, 201),
  extraction: handler(agentService.extraction, 201),
};
