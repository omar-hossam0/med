/**
 * Thin HTTP layer factory.
 *
 * Controllers built with `handler` only translate between HTTP and services:
 * they never contain SQL, and services never write to `res`. The service
 * receives one normalized context object so every endpoint has the same view
 * of the caller, params, body and audit request context.
 */
const { requestContext } = require("../services/auditService");

function handler(serviceFn, statusCode = 200) {
  return async (req, res, next) => {
    try {
      const result = await serviceFn({
        params: req.params || {},
        query: req.query || {},
        body: req.body || {},
        user: req.user,
        actorId: req.user ? req.user.id : null,
        context: requestContext(req),
        req,
      });

      if (result === undefined || result === null) {
        return res.status(statusCode).json({ success: true });
      }
      return res.status(statusCode).json({ success: true, ...result });
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { handler };
