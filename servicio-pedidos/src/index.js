require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB, dbIsReady } = require('./db');
const pedidosRouter = require('./routes/pedidos');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

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

connectDB();

app.listen(PORT, () => {
  console.log(`[servicio-pedidos] escuchando en puerto ${PORT}`);
});
