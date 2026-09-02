require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB, dbIsReady } = require('./db');
const pedidosRouter = require('./routes/pedidos');
const { correlationMiddleware, logEvent } = require('./observability');
const { registerServiceWithRetry } = require('./services/consul');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());
app.use(correlationMiddleware('servicio-pedidos'));

app.use('/pedidos', pedidosRouter);

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
  console.log(`[servicio-pedidos] escuchando en puerto ${PORT}`);
    registerServiceWithRetry({
      id: 'servicio-pedidos', name: 'servicio-pedidos', address: 'servicio-pedidos', port: Number(PORT),
      healthUrl: `http://servicio-pedidos:${PORT}/healthz`
    }, {
      onRegistered: () => logEvent('servicio-pedidos', 'info', 'consul_registered'),
      onError: (error) => logEvent('servicio-pedidos', 'error', 'consul_registration_failed', { error: error.message })
    });
  });
}

start();
