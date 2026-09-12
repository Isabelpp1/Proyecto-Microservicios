const test = require('node:test');
const assert = require('node:assert/strict');

const { buildTokenClaims, createAccessToken } = require('../src/auth');
const { publicUser } = require('../src/presentation');

test('buildTokenClaims incluye sub sin romper userId y email', () => {
  assert.deepEqual(
    buildTokenClaims({ _id: 'usuario-123', email: 'ana@example.com' }),
    { sub: 'usuario-123', userId: 'usuario-123', email: 'ana@example.com' }
  );
});

test('publicUser nunca expone passwordHash', () => {
  assert.deepEqual(
    publicUser({
      _id: 'usuario-123',
      nombre: 'Ana',
      email: 'ana@example.com',
      passwordHash: 'hash-secreto'
    }),
    { id: 'usuario-123', nombre: 'Ana', email: 'ana@example.com' }
  );
});

test('createAccessToken delega claims estándar y expiración configurable al firmador', () => {
  let received;
  const token = createAccessToken(
    { _id: 'usuario-123', email: 'ana@example.com' },
    {
      secret: 'secret',
      expiresIn: '45m',
      jwtImpl: {
        sign(claims, secret, options) {
          received = { claims, secret, options };
          return 'token-firmado';
        }
      }
    }
  );

  assert.equal(token, 'token-firmado');
  assert.deepEqual(received, {
    claims: { sub: 'usuario-123', userId: 'usuario-123', email: 'ana@example.com' },
    secret: 'secret',
    options: { expiresIn: '45m' }
  });
});
