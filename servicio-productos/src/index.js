require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB, dbIsReady } = require('./db');
const productosRouter = require('./routes/productos');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

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

connectDB();

app.listen(PORT, () => {
  console.log(`[servicio-productos] escuchando en puerto ${PORT}`);
});
