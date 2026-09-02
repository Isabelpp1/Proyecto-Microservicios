const test = require('node:test');
const assert = require('node:assert/strict');

const { registerService, resolveService } = require('../src/services/consul');

test('registerService registra nombre, direccion, puerto y health check', async () => {
  let request;

  await registerService(
    {
      id: 'servicio-pedidos',
      name: 'servicio-pedidos',
      address: 'servicio-pedidos',
      port: 3003,
      healthUrl: 'http://servicio-pedidos:3003/healthz'
    },
    {
      consulUrl: 'http://consul:8500',
      fetchImpl: async (url, options) => {
        request = { url, options };
        return { ok: true };
      }
    }
  );

  assert.equal(request.url, 'http://consul:8500/v1/agent/service/register');
  assert.equal(request.options.method, 'PUT');
  assert.deepEqual(JSON.parse(request.options.body), {
    ID: 'servicio-pedidos',
    Name: 'servicio-pedidos',
    Address: 'servicio-pedidos',
    Port: 3003,
    Check: {
      HTTP: 'http://servicio-pedidos:3003/healthz',
      Interval: '10s',
      DeregisterCriticalServiceAfter: '30s'
    }
  });
});

test('resolveService devuelve la URL de la primera instancia saludable', async () => {
  const url = await resolveService('servicio-productos', {
    consulUrl: 'http://consul:8500',
    fetchImpl: async (requestUrl) => {
      assert.equal(
        requestUrl,
        'http://consul:8500/v1/health/service/servicio-productos?passing=true'
      );
      return {
        ok: true,
        json: async () => [{ Service: { Address: 'servicio-productos', Port: 3002 } }]
      };
    }
  });

  assert.equal(url, 'http://servicio-productos:3002');
});

test('resolveService falla cuando Consul no encuentra instancias saludables', async () => {
  await assert.rejects(
    resolveService('servicio-productos', {
      consulUrl: 'http://consul:8500',
      fetchImpl: async () => ({ ok: true, json: async () => [] })
    }),
    /sin instancias saludables/
  );
});
