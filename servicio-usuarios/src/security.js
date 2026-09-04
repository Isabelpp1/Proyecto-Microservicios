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

function assertJwtSecret() {
  assertRequiredEnvironment(['JWT_SECRET']);
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
  }
}

module.exports = { securityHeaders, assertRequiredEnvironment, assertJwtSecret };
