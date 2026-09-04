const express = require('express');
const { randomUUID } = require('crypto');
const Pedido = require('../models/Pedido');
const IdempotencyRecord = require('../models/IdempotencyRecord');
const { validarUsuario, obtenerProducto, reservarStock, liberarStock } = require('../services/clientesExternos');
const { requireAuth } = require('../middleware/auth');
const { logEvent } = require('../observability');
const { validateOrderPayload } = require('../validation');
const { errorResponse, validationResponse } = require('../errors');
const { buildOrderDetails, OrderBusinessError } = require('../services/orderDetails');
const {
  buildOrderFingerprint,
  startIdempotency,
  IdempotencyError
} = require('../services/idempotency');

const router = express.Router();
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function getIdempotencyKey(req) {
  const rawKey = req.headers['idempotency-key'];
  if (rawKey === undefined) return { key: null };
  if (typeof rawKey !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(rawKey)) {
    return { error: 'Idempotency-Key debe tener entre 1 y 128 caracteres seguros' };
  }
  return { key: rawKey };
}

function dependencyResponse(res, req, error) {
  const status = error.response?.status;
  const data = error.response?.data || {};
  if (status === 404) {
    const code = error.dependency === 'servicio-usuarios'
      ? 'USER_NOT_FOUND'
      : 'PRODUCT_NOT_FOUND';
    const message = error.dependency === 'servicio-usuarios'
      ? 'Usuario no existe'
      : 'Producto no existe';
    return errorResponse(res, 404, code, message, req);
  }
  if (status === 400) {
    return errorResponse(res, 400, data.code || 'VALIDATION_ERROR', data.error || 'Solicitud inválida', req, data.details);
  }
  if (status === 409) {
    return errorResponse(res, 409, data.code || 'STOCK_INSUFFICIENT', data.error || 'No se pudo reservar stock', req, data.details);
  }

  logEvent('servicio-pedidos', 'error', 'dependency_unavailable', {
    correlationId: req.correlationId,
    dependency: error.dependency,
    error: error.message
  });
  return errorResponse(
    res,
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Dependencia temporalmente no disponible',
    req,
    { service: error.dependency }
  );
}

async function removeProcessingRecord(record) {
  if (!record) return;
  await IdempotencyRecord.deleteOne({ _id: record._id, status: 'processing' });
}

// POST /pedidos - flujo de creación protegido por JWT.
// body: { items: [{ productoId, cantidad }] }
router.post('/', requireAuth, async (req, res) => {
  const validation = validateOrderPayload(req.body);
  if (!validation.valid) {
    logEvent('servicio-pedidos', 'warn', 'validation_rejected', {
      correlationId: req.correlationId,
      endpoint: 'create_order',
      error_count: validation.errors.length
    });
    return validationResponse(res, req, validation.errors);
  }

  const idempotency = getIdempotencyKey(req);
  if (idempotency.error) {
    return errorResponse(res, 400, 'INVALID_IDEMPOTENCY_KEY', idempotency.error, req);
  }

  const usuarioId = req.auth.userId || req.auth.sub;
  const { items } = validation.value;
  const fingerprint = buildOrderFingerprint(items);
  let idempotencyState = null;
  let reservationMade = false;
  let order = null;

  try {
    if (idempotency.key) {
      idempotencyState = await startIdempotency({
        userId: usuarioId,
        key: idempotency.key,
        fingerprint,
        model: IdempotencyRecord
      });
      if (idempotencyState.status === 'replay') {
        const existingOrder = await Pedido.findById(idempotencyState.record.orderId);
        if (!existingOrder) {
          return errorResponse(res, 503, 'IDEMPOTENCY_RECORD_INCOMPLETE', 'No se encontró el pedido asociado', req);
        }
        logEvent('servicio-pedidos', 'info', 'idempotent_replay', {
          correlationId: req.correlationId,
          order_id: existingOrder._id.toString(),
          user_id: usuarioId
        });
        return res.status(200).json(existingOrder);
      }
      if (idempotencyState.status === 'in_progress') {
        return errorResponse(res, 409, 'IDEMPOTENCY_IN_PROGRESS', 'La solicitud ya está en proceso', req);
      }
    }

    logEvent('servicio-pedidos', 'info', 'order_creation_started', {
      correlationId: req.correlationId,
      user_id: usuarioId
    });

    try {
      await validarUsuario(usuarioId, req.correlationId);
    } catch (error) {
      if (idempotencyState?.status === 'new') await removeProcessingRecord(idempotencyState.record);
      return dependencyResponse(res, req, error);
    }

    let orderDetails;
    try {
      orderDetails = await buildOrderDetails(
        items,
        (productoId) => obtenerProducto(productoId, req.correlationId)
      );
    } catch (error) {
      if (idempotencyState?.status === 'new') await removeProcessingRecord(idempotencyState.record);
      if (error instanceof OrderBusinessError) {
        return errorResponse(res, error.statusCode, error.code, error.message, req, error.details);
      }
      return dependencyResponse(res, req, error);
    }

    const reservationId = idempotencyState?.record
      ? String(idempotencyState.record._id)
      : 'request-' + randomUUID();

    try {
      await reservarStock(items, reservationId, req.correlationId);
      reservationMade = true;
      logEvent('servicio-pedidos', 'info', 'order_stock_reserved', {
        correlationId: req.correlationId,
        reservation_id: reservationId,
        user_id: usuarioId
      });

      order = await Pedido.create({
        usuarioId,
        items: orderDetails.items,
        total: orderDetails.total,
        estado: 'confirmado',
        idempotencyKey: idempotency.key,
        requestFingerprint: idempotency.key ? fingerprint : null
      });

      if (idempotencyState?.status === 'new') {
        await IdempotencyRecord.updateOne(
          { _id: idempotencyState.record._id, status: 'processing' },
          { $set: { status: 'completed', orderId: order._id } }
        );
      }
    } catch (error) {
      if (reservationMade) {
        try {
          await liberarStock(reservationId, req.correlationId);
          reservationMade = false;
          logEvent('servicio-pedidos', 'info', 'order_stock_released', {
            correlationId: req.correlationId,
            reservation_id: reservationId
          });
        } catch (releaseError) {
          logEvent('servicio-pedidos', 'error', 'stock_compensation_failed', {
            correlationId: req.correlationId,
            reservation_id: reservationId,
            error: releaseError.message
          });
        }
      }
      if (order && idempotencyState?.status === 'new') {
        await Pedido.deleteOne({ _id: order._id });
        order = null;
      }
      if (!reservationMade && idempotencyState?.status === 'new') {
        await removeProcessingRecord(idempotencyState.record);
      }
      if (error.response) return dependencyResponse(res, req, error);
      throw error;
    }

    logEvent('servicio-pedidos', 'info', 'order_confirmed', {
      correlationId: req.correlationId,
      order_id: order._id.toString(),
      user_id: usuarioId,
      total: order.total
    });
    return res.status(201).json(order);
  } catch (error) {
    if (error instanceof IdempotencyError) {
      return errorResponse(res, error.statusCode, error.code, error.message, req);
    }
    if (error instanceof OrderBusinessError) {
      return errorResponse(res, error.statusCode, error.code, error.message, req, error.details);
    }
    if (error.response) {
      return dependencyResponse(res, req, error);
    }

    if (idempotencyState?.status === 'new') {
      try {
        await removeProcessingRecord(idempotencyState.record);
      } catch (cleanupError) {
        logEvent('servicio-pedidos', 'error', 'idempotency_cleanup_failed', {
          correlationId: req.correlationId,
          error: cleanupError.message
        });
      }
    }
    logEvent('servicio-pedidos', 'error', 'request_failed', {
      correlationId: req.correlationId,
      endpoint: 'create_order',
      error: error.message
    });
    return errorResponse(res, 500, 'INTERNAL_ERROR', 'Error interno al crear el pedido', req);
  }
});

// GET /pedidos - listar pedidos (opcionalmente filtrando por usuarioId).
router.get('/', async (req, res) => {
  try {
    const filtro = {};
    if (req.query.usuarioId) filtro.usuarioId = req.query.usuarioId;
    const pedidos = await Pedido.find(filtro).sort({ createdAt: -1 });
    return res.json(pedidos);
  } catch (error) {
    logEvent('servicio-pedidos', 'error', 'request_failed', {
      correlationId: req.correlationId,
      endpoint: 'list_orders',
      error: error.message
    });
    return errorResponse(res, 500, 'INTERNAL_ERROR', 'Error interno al listar pedidos', req);
  }
});

// GET /pedidos/:id - consultar un pedido.
router.get('/:id', async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return errorResponse(res, 404, 'ORDER_NOT_FOUND', 'Pedido no encontrado', req);
    }
    return res.json(pedido);
  } catch (error) {
    if (error.name === 'CastError') {
      return errorResponse(res, 400, 'INVALID_ID', 'ID de pedido invalido', req);
    }
    logEvent('servicio-pedidos', 'error', 'request_failed', {
      correlationId: req.correlationId,
      endpoint: 'get_order',
      error: error.message
    });
    return errorResponse(res, 503, 'ORDERS_UNAVAILABLE', 'No se pudo consultar el pedido', req);
  }
});

module.exports = router;
