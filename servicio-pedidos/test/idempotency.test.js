const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildOrderFingerprint,
  classifyIdempotency,
  startIdempotency
} = require('../src/services/idempotency');

test('buildOrderFingerprint es estable aunque cambie el orden de los items', () => {
  const first = buildOrderFingerprint([
    { productoId: 'b', cantidad: 2 },
    { productoId: 'a', cantidad: 1 }
  ]);
  const second = buildOrderFingerprint([
    { productoId: 'a', cantidad: 1 },
    { productoId: 'b', cantidad: 2 }
  ]);

  assert.equal(first, second);
  assert.notEqual(first, buildOrderFingerprint([{ productoId: 'a', cantidad: 2 }]));
});

test('classifyIdempotency distingue solicitud nueva, replay y conflicto', () => {
  assert.equal(classifyIdempotency(null, 'hash-1').status, 'new');
  assert.equal(
    classifyIdempotency({ requestFingerprint: 'hash-1', estado: 'confirmado' }, 'hash-1').status,
    'replay'
  );
  assert.equal(
    classifyIdempotency({ requestFingerprint: 'hash-2', estado: 'confirmado' }, 'hash-1').status,
    'conflict'
  );
  assert.equal(
    classifyIdempotency({ requestFingerprint: 'hash-1', estado: 'procesando' }, 'hash-1').status,
    'in_progress'
  );
});

test('startIdempotency crea una clave nueva y devuelve replay para la misma solicitud', async () => {
  const records = new Map();
  const model = {
    async findOne(query) {
      return records.get(query.usuarioId + ':' + query.key) || null;
    },
    async create(document) {
      const key = document.usuarioId + ':' + document.key;
      if (records.has(key)) {
        const error = new Error('duplicate');
        error.code = 11000;
        throw error;
      }
      const saved = { ...document, _id: 'record-1' };
      records.set(key, saved);
      return saved;
    }
  };

  const first = await startIdempotency({
    userId: 'user-1',
    key: 'key-1',
    fingerprint: 'hash-1',
    model
  });
  const replay = await startIdempotency({
    userId: 'user-1',
    key: 'key-1',
    fingerprint: 'hash-1',
    model
  });

  assert.equal(first.status, 'new');
  assert.equal(replay.status, 'in_progress');
  assert.equal(replay.record._id, 'record-1');
});

test('startIdempotency rechaza la misma clave con otro payload', async () => {
  const model = {
    async findOne() {
      return {
        usuarioId: 'user-1',
        key: 'key-1',
        requestFingerprint: 'hash-original',
        status: 'completed',
        orderId: 'order-1'
      };
    }
  };

  await assert.rejects(
    startIdempotency({ userId: 'user-1', key: 'key-1', fingerprint: 'hash-diferente', model }),
    (error) => error.code === 'IDEMPOTENCY_CONFLICT' && error.statusCode === 409
  );
});
