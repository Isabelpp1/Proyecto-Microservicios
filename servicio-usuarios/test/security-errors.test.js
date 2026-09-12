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

test('errorResponse devuelve un contrato uniforme con correlationId', () => {
  const res = responseDouble();
  errorResponse(res, 400, 'VALIDATION_ERROR', 'Datos inválidos', { correlationId: 'cid-1' }, [
    { field: 'email', code: 'INVALID_EMAIL' }
  ]);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    error: 'Datos inválidos',
    code: 'VALIDATION_ERROR',
    correlationId: 'cid-1',
    details: [{ field: 'email', code: 'INVALID_EMAIL' }]
  });
});

test('securityHeaders agrega headers mínimos de seguridad', () => {
  const res = responseDouble();
  securityHeaders({}, res, () => {});

  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(res.headers['X-Frame-Options'], 'DENY');
  assert.equal(res.headers['Referrer-Policy'], 'no-referrer');
  assert.match(res.headers['Content-Security-Policy'], /default-src 'none'/);
});
