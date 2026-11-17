/** Thin HTTP layer for /api/reference/*. */
const { handler } = require("../utils/controllerHelpers");
const referenceService = require("../services/referenceService");

module.exports = {
  listDocuments: handler(referenceService.listDocuments),
  getDocument: handler(referenceService.getDocument),
  createDocument: handler(referenceService.createDocument, 201),
  createVersion: handler(referenceService.createVersion, 201),
  attachExtraction: handler(referenceService.attachExtraction),
  qualityReview: handler(referenceService.qualityReview),
  approveVersion: handler(referenceService.approveVersion),
  indexVersion: handler(referenceService.indexVersion),
  listChunks: handler(referenceService.listChunks),
  ragQuery: handler(referenceService.ragQuery, 201),
  getRagQuery: handler(referenceService.getRagQuery),
};
