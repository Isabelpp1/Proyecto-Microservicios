const express = require('express');
const Producto = require('../models/Producto');
const { logEvent } = require('../observability');

const router = express.Router();

// GET /productos - listar catalogo (con paginacion simple opcional)
router.get('/', async (req, res) => {
  try {
    const productos = await Producto.find().sort({ createdAt: -1 });
    return res.json(productos);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno al listar productos' });
  }
});

// POST /productos - crear producto en el catalogo
router.post('/', async (req, res) => {
  try {
    const { nombre, descripcion, precio, stock } = req.body;
    if (!nombre || precio === undefined) {
      return res.status(400).json({ error: 'nombre y precio son requeridos' });
    }
    const producto = await Producto.create({ nombre, descripcion, precio, stock: stock || 0 });
    logEvent('servicio-productos', 'info', 'product_created', {
      correlationId: req.correlationId,
      product_id: producto._id.toString()
    });
    return res.status(201).json(producto);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno al crear producto' });
  }
});

// GET /productos/:id - obtener un producto
router.get('/:id', async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    return res.json(producto);
  } catch (err) {
    return res.status(400).json({ error: 'ID de producto invalido' });
  }
});

// PATCH /productos/:id/stock - verificar y descontar stock (usado por servicio-pedidos)
// body: { cantidad: number }  -> descuenta si hay suficiente stock disponible
router.patch('/:id/stock', async (req, res) => {
  try {
    const { cantidad } = req.body;
    if (!cantidad || cantidad <= 0) {
      return res.status(400).json({ error: 'cantidad debe ser un numero positivo' });
    }

    const producto = await Producto.findById(req.params.id);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    if (producto.stock < cantidad) {
      return res.status(409).json({ error: 'Stock insuficiente', stockDisponible: producto.stock });
    }

    producto.stock -= cantidad;
    await producto.save();
    logEvent('servicio-productos', 'info', 'stock_decremented', {
      correlationId: req.correlationId,
      product_id: producto._id.toString(),
      quantity: cantidad,
      stock_remaining: producto.stock
    });

    return res.json({ id: producto._id, stockRestante: producto.stock });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: 'ID de producto invalido' });
  }
});

module.exports = router;
