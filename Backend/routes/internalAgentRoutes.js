const express = require("express");
const internalAgentController = require("../controllers/internalAgentController");
const { requireServiceAuth } = require("../middleware/serviceAuth");
const { agentRunLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// No browser session is accepted here. Every route requires the service token
// and an idempotency_key in the body (validated by the service layer).
router.use(requireServiceAuth, agentRunLimiter);

router.post("/transcription", internalAgentController.transcription);
router.post("/reports", internalAgentController.reports);
router.post("/profile-organization", internalAgentController.profileOrganization);
router.post("/follow-up-scheduling", internalAgentController.followUpScheduling);
router.post("/extraction", internalAgentController.extraction);

module.exports = router;
