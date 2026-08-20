const express = require('express');
const Pedido = require('../models/Pedido');
const { validarUsuario, obtenerProducto, descontarStock } = require('../services/clientesExternos');

const router = express.Router();

// POST /pedidos - flujo de creacion de pedido
// body: { usuarioId, items: [{ productoId, cantidad }] }
router.post('/', async (req, res) => {
  const { usuarioId, items } = req.body;

  if (!usuarioId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'usuarioId e items[] son requeridos' });
  }

  try {
    // 1. Validar al cliente contra servicio-usuarios
    let usuario;
    try {
      usuario = await validarUsuario(usuarioId);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        return res.status(404).json({ error: 'Usuario no existe' });
      }
      console.error('Error al validar usuario:', err.message);
      return res.status(502).json({ error: 'servicio-usuarios no disponible' });
    }

    // 2. Verificar existencias en servicio-productos para cada item y armar detalle
    const itemsDetallados = [];
    let total = 0;

    for (const item of items) {
      let producto;
      try {
        producto = await obtenerProducto(item.productoId);
      } catch (err) {
        if (err.response && err.response.status === 404) {
          return res.status(404).json({ error: `Producto ${item.productoId} no existe` });
        }
        console.error('Error al consultar producto:', err.message);
        return res.status(502).json({ error: 'servicio-productos no disponible' });
      }

      if (producto.stock < item.cantidad) {
        return res.status(409).json({
          error: `Stock insuficiente para ${producto.nombre}`,
          stockDisponible: producto.stock
        });
      }

      itemsDetallados.push({
        productoId: producto._id,
        nombreProducto: producto.nombre,
        cantidad: item.cantidad,
        precioUnitario: producto.precio
      });
      total += producto.precio * item.cantidad;
    }

    // 3. Descontar stock de cada producto (best-effort secuencial para este checkpoint)
    for (const item of itemsDetallados) {
      try {
        await descontarStock(item.productoId, item.cantidad);
      } catch (err) {
        console.error('Error al descontar stock:', err.message);
        return res.status(409).json({ error: `No se pudo reservar stock de ${item.nombreProducto}` });
      }
    }

    // 4. Crear el pedido
    const pedido = await Pedido.create({
      usuarioId,
      items: itemsDetallados,
      total,
      estado: 'confirmado'
    });

    return res.status(201).json(pedido);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno al crear el pedido' });
  }
});

// GET /pedidos - listar pedidos (opcionalmente filtrando por usuarioId)
router.get('/', async (req, res) => {
  try {
    const filtro = {};
    if (req.query.usuarioId) filtro.usuarioId = req.query.usuarioId;
    const pedidos = await Pedido.find(filtro).sort({ createdAt: -1 });
    return res.json(pedidos);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno al listar pedidos' });
  }
});

// GET /pedidos/:id - consultar un pedido
router.get('/:id', async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    return res.json(pedido);
  } catch (err) {
    return res.status(400).json({ error: 'ID de pedido invalido' });
  }
});

module.exports = router;
