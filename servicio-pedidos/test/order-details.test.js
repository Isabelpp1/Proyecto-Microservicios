const test = require('node:test');
const assert = require('node:assert/strict');

const { buildOrderDetails, OrderBusinessError } = require('../src/services/orderDetails');

test('buildOrderDetails obtiene snapshot de productos y calcula total', async () => {
  const result = await buildOrderDetails(
    [
      { productoId: 'producto-a', cantidad: 2 },
      { productoId: 'producto-b', cantidad: 1 }
    ],
    async (productoId) => ({
      _id: productoId,
      nombre: productoId === 'producto-a' ? 'Mouse' : 'Teclado',
      precio: productoId === 'producto-a' ? 25.5 : 40,
      stock: 10
    })
  );

  assert.deepEqual(result, {
    items: [
      { productoId: 'producto-a', nombreProducto: 'Mouse', cantidad: 2, precioUnitario: 25.5 },
      { productoId: 'producto-b', nombreProducto: 'Teclado', cantidad: 1, precioUnitario: 40 }
    ],
    total: 91
  });
});

test('buildOrderDetails rechaza stock insuficiente antes de reservar', async () => {
  await assert.rejects(
    buildOrderDetails(
      [{ productoId: 'producto-a', cantidad: 3 }],
      async () => ({ _id: 'producto-a', nombre: 'Mouse', precio: 25, stock: 2 })
    ),
    (error) => error instanceof OrderBusinessError
      && error.code === 'STOCK_INSUFFICIENT'
      && error.statusCode === 409
  );
});
