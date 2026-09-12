function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"
  );
  next();
}

function assertRequiredEnvironment(requiredNames) {
  const missing = requiredNames.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error('Faltan variables de entorno requeridas: ' + missing.join(', '));
  }
}

module.exports = { securityHeaders, assertRequiredEnvironment };
