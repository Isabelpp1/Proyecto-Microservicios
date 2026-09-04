const express = require('express');
const Producto = require('../models/Producto');
const ReservaStock = require('../models/ReservaStock');
const { logEvent } = require('../observability');
const {
  validateProductPayload,
  validateStockChangePayload,
  validateReservationPayload
} = require('../validation');
const { errorResponse, validationResponse } = require('../errors');
const { requireInternalServiceToken } = require('../security');
const { reserveStock, releaseStock, InventoryError } = require('../services/inventory');

const router = express.Router();

// GET /productos - listar catalogo (con paginacion simple opcional)
router.get('/', async (req, res) => {
  try {
    const productos = await Producto.find().sort({ createdAt: -1 });
    return res.json(productos);
  } catch (err) {
    logEvent('servicio-productos', 'error', 'request_failed', {
      correlationId: req.correlationId,
      endpoint: 'list_products',
      error: err.message
    });
    return errorResponse(res, 503, 'CATALOG_UNAVAILABLE', 'No se pudo consultar el catálogo', req);
  }
});

// POST /productos - crear producto en el catalogo
router.post('/', async (req, res) => {
  try {
    const validation = validateProductPayload(req.body);
    if (!validation.valid) {
      logEvent('servicio-productos', 'warn', 'validation_rejected', {
        correlationId: req.correlationId,
        endpoint: 'create_product',
        error_count: validation.errors.length
      });
      return validationResponse(res, req, validation.errors);
    }
    const producto = await Producto.create(validation.value);
    logEvent('servicio-productos', 'info', 'product_created', {
      correlationId: req.correlationId,
      product_id: producto._id.toString()
    });
    return res.status(201).json(producto);
  } catch (err) {
    logEvent('servicio-productos', 'error', 'request_failed', {
      correlationId: req.correlationId,
      endpoint: 'create_product',
      error: err.message
    });
    return errorResponse(res, 500, 'INTERNAL_ERROR', 'Error interno al crear producto', req);
  }
});

// GET /productos/:id - obtener un producto
router.get('/:id', async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) {
      return errorResponse(res, 404, 'PRODUCT_NOT_FOUND', 'Producto no encontrado', req);
    }
    return res.json(producto);
  } catch (err) {
    if (err.name === 'CastError') {
      return errorResponse(res, 400, 'INVALID_ID', 'ID de producto invalido', req);
    }
    logEvent('servicio-productos', 'error', 'request_failed', {
      correlationId: req.correlationId,
      endpoint: 'get_product',
      error: err.message
    });
    return errorResponse(res, 503, 'CATALOG_UNAVAILABLE', 'No se pudo consultar el producto', req);
  }
});

router.post('/stock/reserve', requireInternalServiceToken, async (req, res) => {
  const validation = validateReservationPayload(req.body);
  if (!validation.valid) return validationResponse(res, req, validation.errors);

  try {
    const reservation = await reserveStock({
      reservationId: validation.value.reservationId,
      items: validation.value.items,
      productModel: Producto,
      reservationModel: ReservaStock
    });
    logEvent('servicio-productos', 'info', 'stock_reserved', {
      correlationId: req.correlationId,
      reservation_id: reservation.reservationId,
      item_count: reservation.items.length
    });
    return res.json(reservation);
  } catch (err) {
    if (err instanceof InventoryError) {
      return errorResponse(res, err.statusCode, err.code, err.message, req);
    }
    logEvent('servicio-productos', 'error', 'reservation_failed', {
      correlationId: req.correlationId,
      reservation_id: req.body?.reservationId,
      error: err.message
    });
    return errorResponse(res, 503, 'INVENTORY_UNAVAILABLE', 'No se pudo reservar inventario', req);
  }
});

router.post('/stock/release', requireInternalServiceToken, async (req, res) => {
  const reservationId = typeof req.body?.reservationId === 'string'
    ? req.body.reservationId.trim()
    : '';
  if (!reservationId) {
    return errorResponse(res, 400, 'VALIDATION_ERROR', 'reservationId es requerido', req);
  }

  try {
    const reservation = await releaseStock({
      reservationId,
      productModel: Producto,
      reservationModel: ReservaStock
    });
    logEvent('servicio-productos', 'info', 'stock_released', {
      correlationId: req.correlationId,
      reservation_id: reservation.reservationId
    });
    return res.json(reservation);
  } catch (err) {
    if (err instanceof InventoryError) {
      return errorResponse(res, err.statusCode, err.code, err.message, req);
    }
    logEvent('servicio-productos', 'error', 'release_failed', {
      correlationId: req.correlationId,
      reservation_id: reservationId,
      error: err.message
    });
    return errorResponse(res, 503, 'INVENTORY_UNAVAILABLE', 'No se pudo liberar inventario', req);
  }
});

// PATCH /productos/:id/stock - verificar y descontar stock (usado por servicio-pedidos)
// body: { cantidad: number }  -> descuenta si hay suficiente stock disponible
router.patch('/:id/stock', requireInternalServiceToken, async (req, res) => {
  try {
    const validation = validateStockChangePayload(req.body);
    if (!validation.valid) return validationResponse(res, req, validation.errors);
    const { cantidad } = validation.value;

    const producto = await Producto.findOneAndUpdate(
      { _id: req.params.id, stock: { $gte: cantidad } },
      { $inc: { stock: -cantidad } },
      { new: true, runValidators: true }
    );
    if (!producto) {
      const existente = await Producto.findById(req.params.id);
      if (!existente) {
        return errorResponse(res, 404, 'PRODUCT_NOT_FOUND', 'Producto no encontrado', req);
      }
      return errorResponse(
        res,
        409,
        'STOCK_INSUFFICIENT',
        'Stock insuficiente',
        req,
        { stockDisponible: existente.stock }
      );
    }

    logEvent('servicio-productos', 'info', 'stock_decremented', {
      correlationId: req.correlationId,
      product_id: producto._id.toString(),
      quantity: cantidad,
      stock_remaining: producto.stock
    });

    return res.json({ id: producto._id, stockRestante: producto.stock });
  } catch (err) {
    if (err.name === 'CastError') {
      return errorResponse(res, 400, 'INVALID_ID', 'ID de producto invalido', req);
    }
    logEvent('servicio-productos', 'error', 'request_failed', {
      correlationId: req.correlationId,
      endpoint: 'decrement_stock',
      error: err.message
    });
    return errorResponse(res, 503, 'INVENTORY_UNAVAILABLE', 'No se pudo actualizar el stock', req);
  }
});

module.exports = router;
