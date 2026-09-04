const test = require('node:test');
const assert = require('node:assert/strict');

const { reserveStock, releaseStock, InventoryError } = require('../src/services/inventory');

function fakeRepositories(initialProducts = {}) {
  const products = new Map(
    Object.entries(initialProducts).map(([id, stock]) => [id, { _id: id, nombre: id, precio: 10, stock }])
  );
  const reservations = new Map();

  const productModel = {
    async findOneAndUpdate(filter, update) {
      const product = products.get(String(filter._id));
      if (!product || product.stock < filter.stock.$gte) return null;
      product.stock += update.$inc.stock;
      return { ...product };
    },
    async findById(id) {
      const product = products.get(String(id));
      return product ? { ...product } : null;
    },
    async updateOne(filter, update) {
      const product = products.get(String(filter._id));
      if (product) product.stock += update.$inc.stock;
      return { acknowledged: true };
    }
  };

  const reservationModel = {
    async findOne(filter) {
      return reservations.get(filter.reservationId) || null;
    },
    async create(document) {
      if (reservations.has(document.reservationId)) {
        const error = new Error('duplicate reservation');
        error.code = 11000;
        throw error;
      }
      const saved = { ...document };
      reservations.set(document.reservationId, saved);
      return saved;
    },
    async findOneAndUpdate(filter, update) {
      const reservation = reservations.get(filter.reservationId);
      if (!reservation || reservation.status !== filter.status) return null;
      Object.assign(reservation, update.$set);
      return { ...reservation };
    },
    async deleteOne(filter) {
      const reservation = reservations.get(filter.reservationId);
      if (reservation && reservation.status === filter.status) reservations.delete(filter.reservationId);
      return { acknowledged: true };
    }
  };

  return {
    productModel,
    reservationModel,
    stock(id) {
      return products.get(id)?.stock;
    },
    reservation(id) {
      return reservations.get(id);
    }
  };
}

test('reserveStock descuenta una reserva y repetirla no descuenta dos veces', async () => {
  const repositories = fakeRepositories({ productoA: 10 });

  const first = await reserveStock({
    reservationId: 'pedido-1',
    items: [{ productoId: 'productoA', cantidad: 3 }],
    ...repositories
  });
  const replay = await reserveStock({
    reservationId: 'pedido-1',
    items: [{ productoId: 'productoA', cantidad: 3 }],
    ...repositories
  });

  assert.equal(first.status, 'reserved');
  assert.equal(replay.status, 'reserved');
  assert.equal(repositories.stock('productoA'), 7);
});

test('reserveStock revierte decrementos anteriores si otro producto no tiene stock', async () => {
  const repositories = fakeRepositories({ productoA: 10, productoB: 1 });

  await assert.rejects(
    reserveStock({
      reservationId: 'pedido-2',
      items: [
        { productoId: 'productoA', cantidad: 4 },
        { productoId: 'productoB', cantidad: 2 }
      ],
      ...repositories
    }),
    (error) => error instanceof InventoryError
      && error.code === 'STOCK_INSUFFICIENT'
      && error.statusCode === 409
  );

  assert.equal(repositories.stock('productoA'), 10);
  assert.equal(repositories.stock('productoB'), 1);
  assert.equal(repositories.reservation('pedido-2'), undefined);
});

test('reserveStock diferencia producto inexistente de stock insuficiente', async () => {
  const repositories = fakeRepositories({ productoA: 10 });

  await assert.rejects(
    reserveStock({
      reservationId: 'pedido-3',
      items: [{ productoId: 'productoB', cantidad: 1 }],
      ...repositories
    }),
    (error) => error.code === 'PRODUCT_NOT_FOUND' && error.statusCode === 404
  );
});

test('releaseStock restaura stock una sola vez', async () => {
  const repositories = fakeRepositories({ productoA: 10 });
  await reserveStock({
    reservationId: 'pedido-4',
    items: [{ productoId: 'productoA', cantidad: 3 }],
    ...repositories
  });

  const first = await releaseStock({ reservationId: 'pedido-4', ...repositories });
  const replay = await releaseStock({ reservationId: 'pedido-4', ...repositories });

  assert.equal(first.status, 'released');
  assert.equal(replay.status, 'released');
  assert.equal(repositories.stock('productoA'), 10);
});
