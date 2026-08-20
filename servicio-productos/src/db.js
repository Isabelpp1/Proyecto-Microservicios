const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  const uri = process.env.MONGO_URI;
  try {
    await mongoose.connect(uri);
    isConnected = true;
    console.log('[servicio-productos] Conectado a MongoDB');
  } catch (err) {
    isConnected = false;
    console.error('[servicio-productos] Error al conectar a MongoDB:', err.message);
  }

  mongoose.connection.on('disconnected', () => { isConnected = false; });
  mongoose.connection.on('connected', () => { isConnected = true; });
}

function dbIsReady() {
  return isConnected && mongoose.connection.readyState === 1;
}

module.exports = { connectDB, dbIsReady };
