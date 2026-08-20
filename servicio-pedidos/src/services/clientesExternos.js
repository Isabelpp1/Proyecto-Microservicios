const axios = require('axios');

const USUARIOS_URL = process.env.USUARIOS_SERVICE_URL;
const PRODUCTOS_URL = process.env.PRODUCTOS_SERVICE_URL;

// Timeout corto: si un servicio no responde rapido, fallamos rapido en vez de colgar el request.
const TIMEOUT_MS = 3000;

async function validarUsuario(usuarioId) {
  const { data } = await axios.get(`${USUARIOS_URL}/usuarios/${usuarioId}`, {
    timeout: TIMEOUT_MS
  });
  return data;
}

async function obtenerProducto(productoId) {
  const { data } = await axios.get(`${PRODUCTOS_URL}/productos/${productoId}`, {
    timeout: TIMEOUT_MS
  });
  return data;
}

async function descontarStock(productoId, cantidad) {
  const { data } = await axios.patch(
    `${PRODUCTOS_URL}/productos/${productoId}/stock`,
    { cantidad },
    { timeout: TIMEOUT_MS }
  );
  return data;
}

module.exports = { validarUsuario, obtenerProducto, descontarStock };
