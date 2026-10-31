/**
 * Centralized error handling middleware for Medora Backend.
 * Ensures internal database details, stack traces, and secrets are never exposed to clients.
 */
function errorHandler(err, req, res, next) {
  // If response has already started streaming, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || err.status || 500;
  const isClientError = statusCode >= 400 && statusCode < 500;

  // Log server errors internally (do not print client credentials)
  if (statusCode >= 500) {
    console.error(`[Server Error] ${req.method} ${req.originalUrl}:`, err.message);
  }

  // Provide a safe, human-readable response
  const response = {
    error: err.name || (isClientError ? "Client Error" : "Internal Server Error"),
    message: isClientError
      ? err.message
      : "An unexpected error occurred. Please try again later.",
  };

  // Stable machine-readable code for deliberate errors, so clients never have
  // to match on English text.
  if (err.code && typeof err.code === "string") {
    response.code = err.code;
  }

  // Optional validation errors array
  if (err.errors && Array.isArray(err.errors)) {
    response.errors = err.errors;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
