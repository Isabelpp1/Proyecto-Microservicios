require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB, dbIsReady } = require('./db');
const productosRouter = require('./routes/productos');
const { correlationMiddleware, logEvent } = require('./observability');
const { registerServiceWithRetry } = require('./consul');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(correlationMiddleware('servicio-productos'));

app.use('/productos', productosRouter);

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
  console.log(`[servicio-productos] escuchando en puerto ${PORT}`);
    registerServiceWithRetry({
      id: 'servicio-productos', name: 'servicio-productos', address: 'servicio-productos', port: Number(PORT),
      healthUrl: `http://servicio-productos:${PORT}/healthz`
    }, {
      onRegistered: () => logEvent('servicio-productos', 'info', 'consul_registered'),
      onError: (error) => logEvent('servicio-productos', 'error', 'consul_registration_failed', { error: error.message })
    });
  });
}

start();
