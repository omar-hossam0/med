const express = require("express");
const referenceController = require("../controllers/referenceController");
const { requireAuth, requireRole } = require("../middleware/auth");
const { requireServiceAuth } = require("../middleware/serviceAuth");
const { verifyCsrf } = require("../middleware/csrf");
const { ragQueryLimiter, clinicalMutationLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// Clinician/admin readers see the reference library. Admin registers sources.
// Extraction and indexing are internal service operations, never browser flows.
const reads = [requireAuth, requireRole("doctor", "admin")];
const admin = [requireAuth, requireRole("admin")];
const service = [requireServiceAuth];
const mutate = [clinicalMutationLimiter, verifyCsrf];

router.get("/documents", ...reads, referenceController.listDocuments);
router.get("/documents/:id", ...reads, referenceController.getDocument);
router.post("/documents", ...admin, ...mutate, referenceController.createDocument);
router.post("/versions", ...admin, ...mutate, referenceController.createVersion);

router.post("/versions/:id/extraction", ...service, verifyCsrf, referenceController.attachExtraction);
router.post("/versions/:id/quality-review", ...reads, ...mutate, referenceController.qualityReview);
router.post("/versions/:id/approve", ...reads, ...mutate, referenceController.approveVersion);
router.post("/versions/:id/index", ...service, verifyCsrf, referenceController.indexVersion);
router.get("/versions/:id/chunks", ...reads, referenceController.listChunks);

router.post("/rag/query", requireAuth, requireRole("doctor"), ragQueryLimiter, verifyCsrf, referenceController.ragQuery);
router.get("/rag/queries/:id", requireAuth, requireRole("doctor"), referenceController.getRagQuery);

module.exports = router;
