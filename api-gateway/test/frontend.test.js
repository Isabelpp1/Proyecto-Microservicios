const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.join(__dirname, '..', 'public');

test('la interfaz visual contiene las áreas básicas de la demo', () => {
  const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');

  for (const id of [
    'register-form',
    'login-form',
    'products-grid',
    'cart-list',
    'create-order',
    'health-grid',
    'operation-message',
    'correlation-id'
  ]) {
    assert.match(html, new RegExp('id=["\\\']' + id + '["\\\']'));
  }
  assert.match(html, /styles\.css/);
  assert.match(html, /app\.js/);
});

test('la interfaz usa el Gateway para los contratos principales', () => {
  const javascript = fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8');

  for (const endpoint of [
    '/api/usuarios/register',
    '/api/usuarios/login',
    '/api/productos',
    '/api/pedidos'
  ]) {
    assert.match(javascript, new RegExp(endpoint.replace('/', '\\/')));
  }
  assert.match(javascript, /Authorization/);
  assert.match(javascript, /Idempotency-Key/);
  assert.match(javascript, /x-correlation-id/);
  assert.match(javascript, /healthz/);
  assert.match(javascript, /readyz/);
});
