require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB, dbIsReady } = require('./db');
const usuariosRouter = require('./routes/usuarios');
const { correlationMiddleware, logEvent } = require('./observability');
const { registerServiceWithRetry, deregisterService } = require('./consul');
const { errorHandler } = require('./errors');
const { securityHeaders, assertRequiredEnvironment, assertJwtSecret } = require('./security');

const app = express();
const PORT = process.env.PORT || 3001;
let server;
let registrationHandle;

app.use(cors());
app.use(securityHeaders);
app.use(correlationMiddleware('servicio-usuarios'));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '100kb' }));

app.use('/usuarios', usuariosRouter);

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/readyz', (req, res) => {
  if (dbIsReady()) {
    return res.json({ status: 'ok', service: 'servicio-usuarios' });
  }
  return res.status(503).json({ status: 'not_ready', service: 'servicio-usuarios' });
});

app.use(errorHandler);

async function start() {
  assertRequiredEnvironment(['MONGO_URI', 'CONSUL_URL']);
  assertJwtSecret();
  await connectDB();
  server = app.listen(PORT, () => {
  logEvent('servicio-usuarios', 'info', 'server_started', { port: Number(PORT) });
    registrationHandle = registerServiceWithRetry({
      id: 'servicio-usuarios', name: 'servicio-usuarios', address: 'servicio-usuarios', port: Number(PORT),
      healthUrl: `http://servicio-usuarios:${PORT}/healthz`
    }, {
      onRegistered: () => logEvent('servicio-usuarios', 'info', 'consul_registered'),
      onError: (error) => logEvent('servicio-usuarios', 'error', 'consul_registration_failed', { error: error.message })
    });
  });
}

start();

async function shutdown() {
  if (registrationHandle) registrationHandle.stop();
  try {
    await deregisterService('servicio-usuarios');
  } catch (error) {
    logEvent('servicio-usuarios', 'warn', 'consul_deregister_failed', { error: error.message });
  }
  if (server) server.close(() => process.exit(0));
  else process.exit(0);
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
