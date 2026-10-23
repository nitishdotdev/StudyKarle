const env = require('../config/env');
const logger = require('../utils/logger');

module.exports = function errorHandler(err, req, res, next) {
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "Payment screenshot must be 5MB or smaller.",
    });
  }

  const statusCode = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
  const isOperational = err.isOperational === true;

  if (!isOperational) {
    logger.error('Unhandled error on ' + req.method + ' ' + req.originalUrl, err);
  }

  // A file stream may already be mid-flight (headers sent) when a downstream
  // error arrives — writing a JSON body then throws a second error. Terminate
  // the response cleanly instead.
  if (res.headersSent) {
    return res.end();
  }

  const body = {
    success: false,
    message: isOperational ? err.message : 'Something went wrong. Please try again.'
  };

  if (err.details) {
    body.details = err.details;
  }

  if (!env.isProduction && !isOperational) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
};
