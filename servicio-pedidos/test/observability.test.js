const test = require('node:test');
const assert = require('node:assert/strict');

const { correlationMiddleware, normalizeCorrelationId } = require('../src/observability');

test('correlationMiddleware reutiliza el x-correlation-id entrante', () => {
  const req = { headers: { 'x-correlation-id': 'demo-123' }, method: 'GET', originalUrl: '/pedidos' };
  const headers = {};
  const res = { setHeader: (key, value) => { headers[key] = value; }, on: () => {} };
  let nextCalled = false;

  correlationMiddleware('servicio-pedidos')(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(req.correlationId, 'demo-123');
  assert.equal(headers['x-correlation-id'], 'demo-123');
});

test('correlationMiddleware genera y devuelve un ID cuando no viene en el request', () => {
  const req = { headers: {}, method: 'GET', originalUrl: '/pedidos' };
  const headers = {};
  const res = { setHeader: (key, value) => { headers[key] = value; }, on: () => {} };

  correlationMiddleware('servicio-pedidos')(req, res, () => {});

  assert.match(req.correlationId, /^[0-9a-f-]{36}$/);
  assert.equal(headers['x-correlation-id'], req.correlationId);
});

test('normalizeCorrelationId reemplaza valores con salto de línea para evitar log injection', () => {
  const correlationId = normalizeCorrelationId('malicioso\nsegundo-evento');

  assert.match(correlationId, /^[0-9a-f-]{36}$/);
});
