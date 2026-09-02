const test = require('node:test');
const assert = require('node:assert/strict');

const { retryWithBackoff } = require('../src/services/retry');
const { CircuitBreaker, CircuitOpenError } = require('../src/services/circuitBreaker');

test('retryWithBackoff reintenta errores transitorios y devuelve el resultado', async () => {
  let attempts = 0;

  const result = await retryWithBackoff(
    async () => {
      attempts += 1;
      if (attempts < 3) {
        const error = new Error('servicio no disponible');
        error.retryable = true;
        throw error;
      }
      return 'ok';
    },
    { delaysMs: [0, 0] }
  );

  assert.equal(result, 'ok');
  assert.equal(attempts, 3);
});

test('retryWithBackoff no reintenta errores de negocio', async () => {
  let attempts = 0;
  const error = new Error('producto no encontrado');
  error.retryable = false;

  await assert.rejects(
    retryWithBackoff(
      async () => {
        attempts += 1;
        throw error;
      },
      { delaysMs: [0, 0] }
    ),
    error
  );

  assert.equal(attempts, 1);
});

test('CircuitBreaker abre tras tres fallos y se recupera despues del tiempo configurado', async () => {
  let currentTime = 0;
  const breaker = new CircuitBreaker({
    failureThreshold: 3,
    resetTimeoutMs: 30,
    now: () => currentTime
  });

  for (let failure = 0; failure < 3; failure += 1) {
    await assert.rejects(breaker.execute(async () => {
      throw new Error('dependencia caida');
    }));
  }

  await assert.rejects(
    breaker.execute(async () => 'no debe ejecutarse'),
    CircuitOpenError
  );

  currentTime = 31;
  const result = await breaker.execute(async () => 'recuperado');

  assert.equal(result, 'recuperado');
  assert.equal(breaker.state, 'CLOSED');
});
