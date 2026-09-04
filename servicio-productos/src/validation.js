const ID_PATTERN = /^[a-f\d]{24}$/i;
const PRODUCT_FIELDS = new Set(['nombre', 'descripcion', 'precio', 'stock']);

function error(field, code, message) {
  return { field, code, message };
}

function unknownFields(payload, allowedFields) {
  return Object.keys(payload || {})
    .filter((field) => !allowedFields.has(field))
    .map((field) => error(field, 'VALIDATION_ERROR', 'Campo no permitido: ' + field));
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateProductPayload(payload) {
  const body = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const errors = unknownFields(body, PRODUCT_FIELDS);
  const value = {
    nombre: typeof body.nombre === 'string' ? body.nombre.trim() : body.nombre,
    descripcion: body.descripcion === undefined
      ? ''
      : typeof body.descripcion === 'string' ? body.descripcion.trim() : body.descripcion,
    precio: body.precio,
    stock: body.stock === undefined ? 0 : body.stock
  };

  if (typeof value.nombre !== 'string' || value.nombre.length < 1 || value.nombre.length > 120) {
    errors.push(error('nombre', 'VALIDATION_ERROR', 'nombre debe tener entre 1 y 120 caracteres'));
  }
  if (typeof value.descripcion !== 'string' || value.descripcion.length > 500) {
    errors.push(error('descripcion', 'VALIDATION_ERROR', 'descripcion debe tener como máximo 500 caracteres'));
  }
  if (!isFiniteNumber(value.precio) || value.precio < 0) {
    errors.push(error('precio', 'INVALID_STOCK', 'precio debe ser un número finito no negativo'));
  }
  if (!isFiniteNumber(value.stock) || !Number.isInteger(value.stock) || value.stock < 0) {
    errors.push(error('stock', 'INVALID_STOCK', 'stock debe ser un entero no negativo'));
  }

  return { valid: errors.length === 0, value, errors };
}

function validateStockChangePayload(payload) {
  const body = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const errors = unknownFields(body, new Set(['cantidad']));
  if (!Number.isInteger(body.cantidad) || body.cantidad <= 0) {
    errors.push(error('cantidad', 'INVALID_STOCK', 'cantidad debe ser un entero positivo'));
  }
  return { valid: errors.length === 0, value: { cantidad: body.cantidad }, errors };
}

function validateReservationPayload(payload) {
  const body = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const errors = unknownFields(body, new Set(['reservationId', 'items']));
  const reservationId = typeof body.reservationId === 'string' ? body.reservationId.trim() : body.reservationId;
  const items = Array.isArray(body.items) ? body.items : [];
  const quantities = new Map();

  if (typeof reservationId !== 'string' || reservationId.length < 1 || reservationId.length > 128) {
    errors.push(error('reservationId', 'VALIDATION_ERROR', 'reservationId es requerido'));
  }
  if (!Array.isArray(body.items) || items.length === 0 || items.length > 50) {
    errors.push(error('items', 'INVALID_ITEMS', 'items debe contener entre 1 y 50 elementos'));
  }

  items.forEach((item, index) => {
    const prefix = 'items[' + index + ']';
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(error(prefix, 'INVALID_ITEMS', 'cada item debe ser un objeto'));
      return;
    }
    const fields = Object.keys(item);
    if (fields.some((field) => !['productoId', 'cantidad'].includes(field))) {
      errors.push(error(prefix, 'VALIDATION_ERROR', 'cada item solo admite productoId y cantidad'));
    }
    if (typeof item.productoId !== 'string' || !ID_PATTERN.test(item.productoId)) {
      errors.push(error(prefix + '.productoId', 'INVALID_ID', 'productoId no es válido'));
    }
    if (!Number.isInteger(item.cantidad) || item.cantidad <= 0 || item.cantidad > 100000) {
      errors.push(error(prefix + '.cantidad', 'INVALID_ITEMS', 'cantidad debe ser un entero positivo'));
    }
    if (ID_PATTERN.test(item.productoId) && Number.isInteger(item.cantidad) && item.cantidad > 0) {
      quantities.set(item.productoId, (quantities.get(item.productoId) || 0) + item.cantidad);
    }
  });

  return {
    valid: errors.length === 0,
    value: {
      reservationId,
      items: [...quantities].map(([productoId, cantidad]) => ({ productoId, cantidad }))
    },
    errors
  };
}

module.exports = {
  validateProductPayload,
  validateStockChangePayload,
  validateReservationPayload
};
