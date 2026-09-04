const mongoose = require('mongoose');
const { logEvent } = require('./observability');

let isConnected = false;

async function connectDB() {
  const uri = process.env.MONGO_URI;
  try {
    await mongoose.connect(uri);
    isConnected = true;
    logEvent('servicio-productos', 'info', 'database_connected');
  } catch (err) {
    isConnected = false;
    logEvent('servicio-productos', 'error', 'database_connection_failed', { error: err.message });
  }

  mongoose.connection.on('disconnected', () => { isConnected = false; });
  mongoose.connection.on('connected', () => { isConnected = true; });
}

function dbIsReady() {
  return isConnected && mongoose.connection.readyState === 1;
}

module.exports = { connectDB, dbIsReady };
