const crypto = require('crypto');
const { errorResponse } = require('./errors');

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  next();
}

function assertRequiredEnvironment(requiredNames) {
  const missing = requiredNames.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error('Faltan variables de entorno requeridas: ' + missing.join(', '));
  }
}

function tokensMatch(received, expected) {
  if (typeof received !== 'string' || typeof expected !== 'string') return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

function requireInternalServiceToken(req, res, next) {
  if (!tokensMatch(req.headers['x-internal-service-token'], process.env.INTERNAL_SERVICE_TOKEN)) {
    return errorResponse(res, 401, 'INTERNAL_AUTH_REQUIRED', 'Token interno requerido', req);
  }
  return next();
}

module.exports = {
  securityHeaders,
  assertRequiredEnvironment,
  requireInternalServiceToken
};
