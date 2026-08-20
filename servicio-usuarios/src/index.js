require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB, dbIsReady } = require('./db');
const usuariosRouter = require('./routes/usuarios');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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

connectDB();

app.listen(PORT, () => {
  console.log(`[servicio-usuarios] escuchando en puerto ${PORT}`);
});
