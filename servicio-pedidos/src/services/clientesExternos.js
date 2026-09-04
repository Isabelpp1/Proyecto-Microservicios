const axios = require('axios');
const { resolveService } = require('./consul');
const { retryWithBackoff } = require('./retry');
const { CircuitBreaker } = require('./circuitBreaker');
const { logEvent } = require('../observability');

const TIMEOUT_MS = 2000;

const breakers = {
  'servicio-usuarios': new CircuitBreaker({ serviceName: 'servicio-usuarios' }),
  'servicio-productos': new CircuitBreaker({ serviceName: 'servicio-productos' })
};

function buildInternalHeaders(correlationId) {
  return {
    'x-correlation-id': correlationId,
    'x-internal-service-token': process.env.INTERNAL_SERVICE_TOKEN
  };
}

function markRetryable(error, serviceName) {
  error.dependency = serviceName;
  const status = error.response?.status;
  error.retryable = !status || status >= 500 || status === 408 || status === 429;
  return error;
}

async function callService(serviceName, correlationId, request) {
  const breaker = breakers[serviceName];

  try {
    return await breaker.execute(() => retryWithBackoff(
      async () => {
        const baseUrl = await resolveService(serviceName);
        try {
          return await request(baseUrl);
        } catch (error) {
          throw markRetryable(error, serviceName);
        }
      },
      {
        onRetry: ({ attempt, delayMs, error }) => logEvent('servicio-pedidos', 'warn', 'dependency_retry', {
          correlationId,
          dependency: serviceName,
          attempt,
          delay_ms: delayMs,
          error: error.message
        })
      }
    ));
  } catch (error) {
    error.dependency = serviceName;
    if (breaker.state === 'OPEN') {
      logEvent('servicio-pedidos', 'warn', 'circuit_open', {
        correlationId,
        dependency: serviceName,
        circuit_state: breaker.state
      });
    }
    throw error;
  }
}

async function validarUsuario(usuarioId, correlationId) {
  return callService('servicio-usuarios', correlationId, async (baseUrl) => {
    const response = await axios.get(
      baseUrl + '/usuarios/' + usuarioId,
      { timeout: TIMEOUT_MS, headers: buildInternalHeaders(correlationId) }
    );
    return response.data;
  });
}

async function obtenerProducto(productoId, correlationId) {
  return callService('servicio-productos', correlationId, async (baseUrl) => {
    const response = await axios.get(
      baseUrl + '/productos/' + productoId,
      { timeout: TIMEOUT_MS, headers: buildInternalHeaders(correlationId) }
    );
    return response.data;
  });
}

async function descontarStock(productoId, cantidad, correlationId) {
  return callService('servicio-productos', correlationId, async (baseUrl) => {
    const response = await axios.patch(
      baseUrl + '/productos/' + productoId + '/stock',
      { cantidad },
      { timeout: TIMEOUT_MS, headers: buildInternalHeaders(correlationId) }
    );
    return response.data;
  });
}

async function reservarStock(items, reservationId, correlationId) {
  return callService('servicio-productos', correlationId, async (baseUrl) => {
    const response = await axios.post(
      baseUrl + '/productos/stock/reserve',
      { items, reservationId },
      { timeout: TIMEOUT_MS, headers: buildInternalHeaders(correlationId) }
    );
    return response.data;
  });
}

async function liberarStock(reservationId, correlationId) {
  return callService('servicio-productos', correlationId, async (baseUrl) => {
    const response = await axios.post(
      baseUrl + '/productos/stock/release',
      { reservationId },
      { timeout: TIMEOUT_MS, headers: buildInternalHeaders(correlationId) }
    );
    return response.data;
  });
}

module.exports = {
  buildInternalHeaders,
  validarUsuario,
  obtenerProducto,
  descontarStock,
  reservarStock,
  liberarStock
};
