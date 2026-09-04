const test = require('node:test');
const assert = require('node:assert/strict');

const { errorResponse } = require('../src/errors');
const { requireInternalServiceToken } = require('../src/security');

function responseDouble() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test('errorResponse conserva error y agrega código y correlación', () => {
  const res = responseDouble();
  errorResponse(res, 409, 'STOCK_INSUFFICIENT', 'Stock insuficiente', { correlationId: 'cid-2' });

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, {
    error: 'Stock insuficiente',
    code: 'STOCK_INSUFFICIENT',
    correlationId: 'cid-2'
  });
});

test('requireInternalServiceToken rechaza token ausente y acepta token configurado', () => {
  process.env.INTERNAL_SERVICE_TOKEN = 'token-de-prueba';
  const unauthorized = responseDouble();
  let nextCalled = false;

  requireInternalServiceToken({ headers: {} }, unauthorized, () => { nextCalled = true; });

  assert.equal(unauthorized.statusCode, 401);
  assert.equal(unauthorized.body.code, 'INTERNAL_AUTH_REQUIRED');
  assert.equal(nextCalled, false);

  const authorized = responseDouble();
  requireInternalServiceToken(
    { headers: { 'x-internal-service-token': 'token-de-prueba' } },
    authorized,
    () => { nextCalled = true; }
  );

  assert.equal(nextCalled, true);
  assert.equal(authorized.body, null);
});
