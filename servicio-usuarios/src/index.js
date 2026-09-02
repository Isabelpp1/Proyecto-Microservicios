require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB, dbIsReady } = require('./db');
const usuariosRouter = require('./routes/usuarios');
const { correlationMiddleware, logEvent } = require('./observability');
const { registerServiceWithRetry } = require('./consul');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(correlationMiddleware('servicio-usuarios'));

app.use('/usuarios', usuariosRouter);

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/readyz', (req, res) => {
  if (dbIsReady()) {
    return res.json({ status: 'ok' });
  }
  return res.status(503).json({ status: 'not_ready' });
});

async function start() {
  await connectDB();
  app.listen(PORT, () => {
  console.log(`[servicio-usuarios] escuchando en puerto ${PORT}`);
    registerServiceWithRetry({
      id: 'servicio-usuarios', name: 'servicio-usuarios', address: 'servicio-usuarios', port: Number(PORT),
      healthUrl: `http://servicio-usuarios:${PORT}/healthz`
    }, {
      onRegistered: () => logEvent('servicio-usuarios', 'info', 'consul_registered'),
      onError: (error) => logEvent('servicio-usuarios', 'error', 'consul_registration_failed', { error: error.message })
    });
  });
}

start();
