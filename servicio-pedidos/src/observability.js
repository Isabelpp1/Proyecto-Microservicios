const { randomUUID } = require('crypto');

function logEvent(service, level, event, fields = {}) {
  console.log(JSON.stringify({
    correlation_id: fields.correlationId,
    service,
    event,
    level,
    timestamp: new Date().toISOString(),
    ...fields,
    correlationId: undefined
  }));
}

function correlationMiddleware(service) {
  return (req, res, next) => {
    const correlationId = req.headers['x-correlation-id'] || randomUUID();
    const startedAt = Date.now();
    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    logEvent(service, 'info', 'request_received', {
      correlationId,
      method: req.method,
      path: req.originalUrl
    });

    res.on('finish', () => {
      logEvent(service, 'info', 'request_completed', {
        correlationId,
        method: req.method,
        path: req.originalUrl,
        status_code: res.statusCode,
        duration_ms: Date.now() - startedAt
      });
    });

    next();
  };
}

module.exports = { correlationMiddleware, logEvent };
