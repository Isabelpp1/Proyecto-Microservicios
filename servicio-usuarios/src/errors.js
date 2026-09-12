function errorResponse(res, status, code, message, req = {}, details) {
  const payload = {
    error: message,
    code,
    correlationId: req.correlationId || 'unknown'
  };
  if (details !== undefined) payload.details = details;
  return res.status(status).json(payload);
}

function validationResponse(res, req, errors) {
  return errorResponse(res, 400, 'VALIDATION_ERROR', 'Datos de entrada inválidos', req, errors);
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.too.large') {
    return errorResponse(res, 413, 'PAYLOAD_TOO_LARGE', 'El payload excede el límite permitido', req);
  }
  if (error instanceof SyntaxError && error.status === 400 && error.body !== undefined) {
    return errorResponse(res, 400, 'MALFORMED_JSON', 'El body JSON no es válido', req);
  }
  return errorResponse(res, 500, 'INTERNAL_ERROR', 'Error interno del servicio', req);
}

module.exports = { errorResponse, validationResponse, errorHandler };
