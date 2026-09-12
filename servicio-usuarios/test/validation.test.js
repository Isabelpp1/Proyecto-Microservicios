const test = require('node:test');
const assert = require('node:assert/strict');

const { validateRegisterPayload, validateLoginPayload } = require('../src/validation');

test('validateRegisterPayload normaliza un registro válido', () => {
  const result = validateRegisterPayload({
    nombre: ' Ana Lopez ',
    email: ' ANA@EXAMPLE.COM ',
    password: 'secreta123',
    direccion: '  Zona 1 '
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.value, {
    nombre: 'Ana Lopez',
    email: 'ana@example.com',
    password: 'secreta123',
    direccion: 'Zona 1'
  });
});

test('validateRegisterPayload rechaza email inválido y password corto', () => {
  const result = validateRegisterPayload({
    nombre: 'Ana',
    email: 'no-es-email',
    password: 'corto'
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors.map((error) => error.code), [
    'INVALID_EMAIL',
    'INVALID_CREDENTIALS'
  ]);
});

test('validateRegisterPayload rechaza propiedades desconocidas', () => {
  const result = validateRegisterPayload({
    nombre: 'Ana',
    email: 'ana@example.com',
    password: 'secreta123',
    rol: 'admin'
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors[0].code, 'VALIDATION_ERROR');
});

test('validateLoginPayload normaliza email y rechaza campos faltantes', () => {
  const result = validateLoginPayload({ email: ' ANA@EXAMPLE.COM ', password: '' });

  assert.equal(result.valid, false);
  assert.equal(result.value.email, 'ana@example.com');
  assert.deepEqual(result.errors.map((error) => error.code), ['INVALID_CREDENTIALS']);
});
