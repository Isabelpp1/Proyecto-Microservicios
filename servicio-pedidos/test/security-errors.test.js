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

test('errorResponse funciona sin request y usa correlationId desconocido', () => {
  const res = responseDouble();
  errorResponse(res, 500, 'INTERNAL_ERROR', 'Error interno');

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    error: 'Error interno',
    code: 'INTERNAL_ERROR',
    correlationId: 'unknown'
  });
});

test('securityHeaders evita framing y sniffing de contenido', () => {
  const res = responseDouble();
  securityHeaders({}, res, () => {});

  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(res.headers['X-Frame-Options'], 'DENY');
});
