const test = require('node:test');
const assert = require('node:assert/strict');

const { validateOrderPayload } = require('../src/validation');

test('validateOrderPayload consolida items repetidos y descarta usuarioId legado', () => {
  const result = validateOrderPayload({
    usuarioId: 'usuario-ignorado',
    items: [
      { productoId: '507f1f77bcf86cd799439011', cantidad: 2 },
      { productoId: '507f1f77bcf86cd799439011', cantidad: 3 }
    ]
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.value, {
    items: [{ productoId: '507f1f77bcf86cd799439011', cantidad: 5 }]
  });
});

test('validateOrderPayload rechaza IDs y cantidades inválidos', () => {
  const result = validateOrderPayload({
    items: [
      { productoId: 'producto-invalido', cantidad: 1.5 },
      { productoId: '507f1f77bcf86cd799439012', cantidad: 0 }
    ]
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors.map((error) => error.code), [
    'INVALID_ID',
    'INVALID_ITEMS',
    'INVALID_ITEMS'
  ]);
});

test('validateOrderPayload limita el tamaño y rechaza propiedades desconocidas', () => {
  const result = validateOrderPayload({
    items: [{ productoId: '507f1f77bcf86cd799439011', cantidad: 1, precio: 10 }]
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors[0].code, 'VALIDATION_ERROR');
});
