/**
 * Small factory for errors the API can return deliberately.
 *
 * The central error handler already understands `statusCode` and `errors`;
 * `code` is a stable machine-readable value the frontend can branch on without
 * parsing English messages.
 */
function httpError(statusCode, code, message, errors) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  if (errors) err.errors = errors;
  return err;
}

module.exports = { httpError };
