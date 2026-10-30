const adminDirectoryService = require("../services/adminDirectoryService");
const { requestContext } = require("../services/auditService");

async function list(req, res, next) {
  try {
    const result = await adminDirectoryService.listMembers(req.query);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function detail(req, res, next) {
  try {
    const member = await adminDirectoryService.getMember(req.params.id);
    res.status(200).json({ success: true, member });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const member = await adminDirectoryService.updateMember(
      req.params.id,
      req.body,
      req.user,
      requestContext(req)
    );

    res.status(200).json({ success: true, member });
  } catch (err) {
    next(err);
  }
}

async function verify(req, res, next) {
  try {
    const member = await adminDirectoryService.setVerification(
      req.params.id,
      req.body,
      req.user,
      requestContext(req)
    );

    res.status(200).json({ success: true, member });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, detail, update, verify };
