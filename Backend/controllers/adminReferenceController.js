const adminReferenceService = require("../services/adminReferenceService");

async function get(req, res, next) {
  try {
    const reference = await adminReferenceService.getReferenceData();
    res.status(200).json({ success: true, ...reference });
  } catch (err) {
    next(err);
  }
}

module.exports = { get };
