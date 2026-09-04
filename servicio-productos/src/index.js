require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB, dbIsReady } = require('./db');
const productosRouter = require('./routes/productos');
const { correlationMiddleware, logEvent } = require('./observability');
const { registerServiceWithRetry, deregisterService } = require('./consul');
const { errorHandler } = require('./errors');
const { securityHeaders, assertRequiredEnvironment } = require('./security');

const app = express();
const PORT = process.env.PORT || 3002;
let server;
let registrationHandle;

app.use(cors());
app.use(securityHeaders);
app.use(correlationMiddleware('servicio-productos'));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '100kb' }));

app.use('/productos', productosRouter);

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/readyz', (req, res) => {
  if (dbIsReady()) {
    return res.json({ status: 'ok', service: 'servicio-productos' });
  }
  return res.status(503).json({ status: 'not_ready', service: 'servicio-productos' });
});

app.use(errorHandler);

async function start() {
  assertRequiredEnvironment(['MONGO_URI', 'CONSUL_URL', 'INTERNAL_SERVICE_TOKEN']);
  await connectDB();
  server = app.listen(PORT, () => {
  logEvent('servicio-productos', 'info', 'server_started', { port: Number(PORT) });
    registrationHandle = registerServiceWithRetry({
      id: 'servicio-productos', name: 'servicio-productos', address: 'servicio-productos', port: Number(PORT),
      healthUrl: `http://servicio-productos:${PORT}/healthz`
    }, {
      onRegistered: () => logEvent('servicio-productos', 'info', 'consul_registered'),
      onError: (error) => logEvent('servicio-productos', 'error', 'consul_registration_failed', { error: error.message })
    });
  });
}

start();

async function shutdown() {
  if (registrationHandle) registrationHandle.stop();
  try {
    await deregisterService('servicio-productos');
  } catch (error) {
    logEvent('servicio-productos', 'warn', 'consul_deregister_failed', { error: error.message });
  }
  if (server) server.close(() => process.exit(0));
  else process.exit(0);
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
