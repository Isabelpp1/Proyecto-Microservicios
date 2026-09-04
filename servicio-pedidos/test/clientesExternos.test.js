const test = require('node:test');
const assert = require('node:assert/strict');

const { buildInternalHeaders } = require('../src/services/clientesExternos');

test('buildInternalHeaders propaga correlación y secreto interno sin exponer otros campos', () => {
  process.env.INTERNAL_SERVICE_TOKEN = 'token-interno-de-prueba';

  assert.deepEqual(buildInternalHeaders('cid-order-1'), {
    'x-correlation-id': 'cid-order-1',
    'x-internal-service-token': 'token-interno-de-prueba'
  });
});
