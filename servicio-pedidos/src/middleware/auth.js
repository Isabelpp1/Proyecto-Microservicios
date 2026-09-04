const jwt = require('jsonwebtoken');
const { errorResponse } = require('../errors');

function requireAuth(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return errorResponse(res, 401, 'AUTH_REQUIRED', 'Token de autenticacion requerido', req);
  }

  const token = authorization.slice('Bearer '.length).trim();
  try {
    req.auth = jwt.verify(token, process.env.JWT_SECRET);
    if (!req.auth.userId && !req.auth.sub) throw new Error('user claim missing');
    if (!req.auth.userId) req.auth.userId = String(req.auth.sub);
    return next();
  } catch (error) {
    return errorResponse(res, 401, 'AUTH_INVALID', 'Token invalido o expirado', req);
  }
}

module.exports = { requireAuth };
