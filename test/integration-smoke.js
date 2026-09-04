const assert = require('node:assert/strict');

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const consulUrl = process.env.CONSUL_URL_EXTERNAL || 'http://localhost:8500';
const expectProductosDown = process.env.EXPECT_PRODUCTOS_DOWN === 'true';

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(baseUrl + path, {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...(options.headers || {})
      }
    });
  } catch (error) {
    throw new Error(
      'No se pudo conectar a ' + baseUrl + '. Levanta Compose antes de ejecutar el smoke test. ' + error.message
    );
  }

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch (error) {
      throw new Error('Respuesta no JSON en ' + path + ': ' + text.slice(0, 120));
    }
  }
  return { response, body };
}

function jsonHeaders(extra = {}) {
  return { 'content-type': 'application/json', ...extra };
}

async function expectStatus(path, expectedStatus, options = {}) {
  const result = await request(path, options);
  assert.equal(result.response.status, expectedStatus, path + ' devolvió un status inesperado');
  return result;
}

async function countOrders(usuarioId, token) {
  const result = await request('/api/pedidos?usuarioId=' + encodeURIComponent(usuarioId), {
    headers: jsonHeaders({ authorization: 'Bearer ' + token })
  });
  assert.equal(result.response.status, 200);
  return result.body.length;
}

async function run() {
  if (expectProductosDown) {
    const token = process.env.E2E_TOKEN;
    const usuarioId = process.env.E2E_USER_ID;
    const productId = process.env.E2E_PRODUCT_ID;
    assert.ok(token && usuarioId && productId, 'E2E_TOKEN, E2E_USER_ID y E2E_PRODUCT_ID son requeridos en modo dependencia caída');
    const beforeDependencyFailure = await countOrders(usuarioId, token);
    await expectStatus('/api/pedidos', 503, {
      method: 'POST',
      headers: jsonHeaders({
        authorization: 'Bearer ' + token,
        'idempotency-key': 'dependency-' + Date.now()
      }),
      body: JSON.stringify({ items: [{ productoId: productId, cantidad: 1 }] })
    });
    assert.equal(await countOrders(usuarioId, token), beforeDependencyFailure);
    console.log(JSON.stringify({
      status: 'ok',
      baseUrl,
      dependencyFailureChecked: true,
      ordersUnchanged: true
    }));
    return;
  }

  await expectStatus('/healthz', 200);
  await expectStatus('/api/usuarios/healthz', 200);
  await expectStatus('/api/productos/healthz', 200);
  await expectStatus('/api/pedidos/healthz', 200);
  await expectStatus('/api/usuarios/readyz', 200);
  await expectStatus('/api/productos/readyz', 200);
  await expectStatus('/api/pedidos/readyz', 200);

  const consulResponse = await fetch(consulUrl + '/v1/health/service/servicio-pedidos?passing=true');
  assert.equal(consulResponse.status, 200, 'Consul no respondió correctamente');
  const consulServices = await consulResponse.json();
  assert.ok(consulServices.length > 0, 'Consul no tiene una instancia saludable de Pedidos');

  const suffix = Date.now();
  const email = 'smoke-' + suffix + '@example.com';
  const password = 'ClaveSegura123';
  const register = await expectStatus('/api/usuarios/register', 201, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ nombre: 'Smoke Test', email, password })
  });
  assert.ok(register.body.id);

  await expectStatus('/api/usuarios/login', 401, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ email, password: 'incorrecta' })
  });

  const login = await expectStatus('/api/usuarios/login', 200, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ email, password })
  });
  assert.ok(login.body.token);
  const token = login.body.token;

  await expectStatus('/api/pedidos', 401, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ items: [] })
  });

  const product = await expectStatus('/api/productos', 201, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ nombre: 'Producto smoke', precio: 12.5, stock: 3 })
  });
  const productId = product.body._id;
  assert.ok(productId);

  const idempotencyKey = 'smoke-' + suffix;
  const orderPayload = { items: [{ productoId: productId, cantidad: 2 }] };
  const order = await expectStatus('/api/pedidos', 201, {
    method: 'POST',
    headers: jsonHeaders({
      authorization: 'Bearer ' + token,
      'idempotency-key': idempotencyKey,
      'x-correlation-id': 'smoke-' + suffix
    }),
    body: JSON.stringify(orderPayload)
  });
  assert.equal(order.body.estado, 'confirmado');
  assert.equal(order.body.total, 25);

  const replay = await expectStatus('/api/pedidos', 200, {
    method: 'POST',
    headers: jsonHeaders({
      authorization: 'Bearer ' + token,
      'idempotency-key': idempotencyKey
    }),
    body: JSON.stringify(orderPayload)
  });
  assert.equal(String(replay.body._id), String(order.body._id));

  const productAfterOrder = await expectStatus('/api/productos/' + productId, 200);
  assert.equal(productAfterOrder.body.stock, 1);
  const ordersBeforeRejected = await countOrders(register.body.id, token);

  await expectStatus('/api/pedidos', 409, {
    method: 'POST',
    headers: jsonHeaders({
      authorization: 'Bearer ' + token,
      'idempotency-key': 'stock-' + suffix
    }),
    body: JSON.stringify({ items: [{ productoId: productId, cantidad: 99 }] })
  });

  const productAfterRejected = await expectStatus('/api/productos/' + productId, 200);
  assert.equal(productAfterRejected.body.stock, 1);
  assert.equal(await countOrders(register.body.id, token), ordersBeforeRejected);

  await expectStatus('/api/pedidos', 400, {
    method: 'POST',
    headers: jsonHeaders({ authorization: 'Bearer ' + token }),
    body: JSON.stringify({ items: [{ productoId: 'not-an-id', cantidad: 1 }] })
  });

  console.log(JSON.stringify({
    status: 'ok',
    baseUrl,
    usuarioId: register.body.id,
    productoId: productId,
    pedidoId: order.body._id,
    dependencyFailureChecked: false
  }));
}

run().catch((error) => {
  console.error(JSON.stringify({ status: 'failed', error: error.message }));
  process.exitCode = 1;
});
