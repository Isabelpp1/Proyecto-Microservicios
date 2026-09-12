const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateProductPayload,
  validateStockChangePayload,
  validateReservationPayload
} = require('../src/validation');

test('validateProductPayload normaliza un producto válido', () => {
  const result = validateProductPayload({
    nombre: ' Mouse ',
    descripcion: ' Inalámbrico ',
    precio: 25.5,
    stock: 10
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.value, {
    nombre: 'Mouse',
    descripcion: 'Inalámbrico',
    precio: 25.5,
    stock: 10
  });
});

test('validateProductPayload rechaza precio y stock negativos', () => {
  const result = validateProductPayload({
    nombre: 'Mouse',
    precio: -1,
    stock: -2
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors.map((error) => error.code), [
    'INVALID_STOCK',
    'INVALID_STOCK'
  ]);
});

test('validateStockChangePayload acepta únicamente cantidad entera positiva', () => {
  assert.equal(validateStockChangePayload({ cantidad: 2 }).valid, true);
  assert.equal(validateStockChangePayload({ cantidad: 0 }).valid, false);
  assert.equal(validateStockChangePayload({ cantidad: 1.5 }).valid, false);
});

test('validateReservationPayload consolida productos repetidos', () => {
  const result = validateReservationPayload({
    reservationId: 'pedido-123',
    items: [
      { productoId: '507f1f77bcf86cd799439011', cantidad: 2 },
      { productoId: '507f1f77bcf86cd799439011', cantidad: 3 }
    ]
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.value.items, [
    { productoId: '507f1f77bcf86cd799439011', cantidad: 5 }
  ]);
});
