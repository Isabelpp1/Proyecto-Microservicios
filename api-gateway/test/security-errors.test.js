const test = require('node:test');
const assert = require('node:assert/strict');

const { errorResponse } = require('../src/errors');
const { securityHeaders } = require('../src/security');

function responseDouble() {
  const response = {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  return response;
}

test('Gateway normaliza errores de forma consistente', () => {
  const res = responseDouble();
  errorResponse(res, 404, 'ROUTE_NOT_FOUND', 'Ruta no encontrada', { correlationId: 'cid-gw' });

  assert.deepEqual(res.body, {
    error: 'Ruta no encontrada',
    code: 'ROUTE_NOT_FOUND',
    correlationId: 'cid-gw'
  });
});

test('Gateway agrega headers de seguridad', () => {
  const res = responseDouble();
  securityHeaders({}, res, () => {});

  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(res.headers['X-Frame-Options'], 'DENY');
  assert.match(res.headers['Content-Security-Policy'], /default-src 'self'/);
});
