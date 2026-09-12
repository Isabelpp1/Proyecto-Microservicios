require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB, dbIsReady } = require('./db');
const pedidosRouter = require('./routes/pedidos');
const { correlationMiddleware, logEvent } = require('./observability');
const { registerServiceWithRetry, deregisterService } = require('./services/consul');
const { errorHandler } = require('./errors');
const { securityHeaders, assertRequiredEnvironment, assertJwtSecret } = require('./security');

const app = express();
const PORT = process.env.PORT || 3003;
let server;
let registrationHandle;

app.use(cors());
app.use(securityHeaders);
app.use(correlationMiddleware('servicio-pedidos'));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '100kb' }));

app.use('/pedidos', pedidosRouter);

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/readyz', (req, res) => {
  if (dbIsReady()) {
    return res.json({ status: 'ok', service: 'servicio-pedidos' });
  }
  return res.status(503).json({ status: 'not_ready', service: 'servicio-pedidos' });
});

app.use(errorHandler);

async function start() {
  assertRequiredEnvironment(['MONGO_URI', 'CONSUL_URL', 'INTERNAL_SERVICE_TOKEN']);
  assertJwtSecret();
  await connectDB();
  server = app.listen(PORT, () => {
  logEvent('servicio-pedidos', 'info', 'server_started', { port: Number(PORT) });
    registrationHandle = registerServiceWithRetry({
      id: 'servicio-pedidos', name: 'servicio-pedidos', address: 'servicio-pedidos', port: Number(PORT),
      healthUrl: `http://servicio-pedidos:${PORT}/healthz`
    }, {
      onRegistered: () => logEvent('servicio-pedidos', 'info', 'consul_registered'),
      onError: (error) => logEvent('servicio-pedidos', 'error', 'consul_registration_failed', { error: error.message })
    });
  });
}

start();

async function shutdown() {
  if (registrationHandle) registrationHandle.stop();
  try {
    await deregisterService('servicio-pedidos');
  } catch (error) {
    logEvent('servicio-pedidos', 'warn', 'consul_deregister_failed', { error: error.message });
  }
  if (server) server.close(() => process.exit(0));
  else process.exit(0);
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
