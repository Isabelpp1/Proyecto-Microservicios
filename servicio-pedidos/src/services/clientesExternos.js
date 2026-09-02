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

function markRetryable(error, serviceName) {
  error.dependency = serviceName;
  error.retryable = !(error.response && error.response.status < 500);
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
    const { data } = await axios.get(`${baseUrl}/usuarios/${usuarioId}`, {
      timeout: TIMEOUT_MS,
      headers: { 'x-correlation-id': correlationId }
    });
    return data;
  });
}

async function obtenerProducto(productoId, correlationId) {
  return callService('servicio-productos', correlationId, async (baseUrl) => {
    const { data } = await axios.get(`${baseUrl}/productos/${productoId}`, {
      timeout: TIMEOUT_MS,
      headers: { 'x-correlation-id': correlationId }
    });
    return data;
  });
}

async function descontarStock(productoId, cantidad, correlationId) {
  return callService('servicio-productos', correlationId, async (baseUrl) => {
    const { data } = await axios.patch(
      `${baseUrl}/productos/${productoId}/stock`,
      { cantidad },
      {
        timeout: TIMEOUT_MS,
        headers: { 'x-correlation-id': correlationId }
      }
    );
    return data;
  });
}

module.exports = { validarUsuario, obtenerProducto, descontarStock };
