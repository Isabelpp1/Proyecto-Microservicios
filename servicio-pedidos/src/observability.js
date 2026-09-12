const { randomUUID } = require('crypto');

function normalizeCorrelationId(value) {
  if (
    typeof value !== 'string'
    || value.length < 1
    || value.length > 128
    || /[\r\n]/.test(value)
  ) {
    return randomUUID();
  }
  return value;
}

function logEvent(service, level, event, fields = {}) {
  const { correlationId, ...rest } = fields;
  console.log(JSON.stringify({
    correlation_id: correlationId || 'system',
    service,
    event,
    level,
    timestamp: new Date().toISOString(),
    ...rest
  }));
}

function correlationMiddleware(service) {
  return (req, res, next) => {
    const correlationId = normalizeCorrelationId(req.headers['x-correlation-id']);
    const startedAt = Date.now();
    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    logEvent(service, 'info', 'request_received', {
      correlationId,
      method: req.method,
      path: req.originalUrl
    });
    res.on('finish', () => logEvent(service, 'info', 'request_completed', {
      correlationId,
      method: req.method,
      path: req.originalUrl,
      status_code: res.statusCode,
      duration_ms: Date.now() - startedAt
    }));
    next();
  };
}

module.exports = { correlationMiddleware, logEvent, normalizeCorrelationId };
