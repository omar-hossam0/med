const adminUsersService = require("../services/adminUsersService");
const { requestContext } = require("../services/auditService");

function presentInvitation(invitation) {
  return {
    purpose: invitation.purpose,
    expires_at: invitation.expiresAt,
    // Returned once. There is no mailer in this project yet, so the
    // authenticated administrator hands this link over out of band.
    activation_token: invitation.token,
    activation_path: `/activate?token=${invitation.token}`,
  };
}

async function list(req, res, next) {
  try {
    const result = await adminUsersService.listUsers(req.query);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function detail(req, res, next) {
  try {
    const user = await adminUsersService.getUser(req.params.id);
    res.status(200).json({ success: true, user });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const result = await adminUsersService.provisionUser(
      req.body,
      req.user,
      requestContext(req)
    );

    res.status(201).json({
      success: true,
      user: result.user,
      invitation: presentInvitation(result.invitation),
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const user = await adminUsersService.updateUser(
      req.params.id,
      req.body,
      req.user,
      requestContext(req)
    );

    res.status(200).json({ success: true, user });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const user = await adminUsersService.updateStatus(
      req.params.id,
      req.body,
      req.user,
      requestContext(req)
    );

    res.status(200).json({ success: true, user });
  } catch (err) {
    next(err);
  }
}

async function invite(req, res, next) {
  try {
    const invitation = await adminUsersService.issueInvitation(
      req.params.id,
      req.body,
      req.user,
      requestContext(req)
    );

    res.status(201).json({
      success: true,
      invitation: presentInvitation(invitation),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, detail, create, update, updateStatus, invite };
