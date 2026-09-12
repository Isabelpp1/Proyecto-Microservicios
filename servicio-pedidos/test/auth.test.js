const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

const { requireAuth } = require('../src/middleware/auth');

function runMiddleware(headers = {}) {
  const req = { headers };
  let statusCode;
  let body;
  let nextCalled = false;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
    }
  };

  requireAuth(req, res, () => { nextCalled = true; });
  return { req, statusCode, body, nextCalled };
}

test('requireAuth rechaza una solicitud sin Bearer token', () => {
  const result = runMiddleware();

  assert.equal(result.statusCode, 401);
  assert.equal(result.body.error, 'Token de autenticacion requerido');
  assert.equal(result.nextCalled, false);
});

test('requireAuth rechaza un Bearer token invalido', () => {
  const result = runMiddleware({ authorization: 'Bearer token-invalido' });

  assert.equal(result.statusCode, 401);
  assert.equal(result.body.error, 'Token invalido o expirado');
  assert.equal(result.nextCalled, false);
});

test('requireAuth expone el usuario validado en la solicitud', () => {
  const token = jwt.sign({ userId: 'usuario-123', email: 'ana@example.com' }, process.env.JWT_SECRET);
  const result = runMiddleware({ authorization: `Bearer ${token}` });

  assert.equal(result.nextCalled, true);
  assert.equal(result.req.auth.userId, 'usuario-123');
});

test('requireAuth acepta el claim estándar sub como fallback de userId', () => {
  const token = jwt.sign({ sub: 'usuario-456', email: 'ana@example.com' }, process.env.JWT_SECRET);
  const result = runMiddleware({ authorization: 'Bearer ' + token });

  assert.equal(result.nextCalled, true);
  assert.equal(result.req.auth.userId, 'usuario-456');
});

test('requireAuth rechaza un Bearer vacío', () => {
  const result = runMiddleware({ authorization: 'Bearer ' });

  assert.equal(result.statusCode, 401);
  assert.equal(result.body.error, 'Token invalido o expirado');
  assert.equal(result.nextCalled, false);
});
