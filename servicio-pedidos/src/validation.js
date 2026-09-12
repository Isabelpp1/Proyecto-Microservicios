const ID_PATTERN = /^[a-f\d]{24}$/i;

function error(field, code, message) {
  return { field, code, message };
}

function validateOrderPayload(payload) {
  const body = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const errors = Object.keys(body)
    .filter((field) => !['items', 'usuarioId'].includes(field))
    .map((field) => error(field, 'VALIDATION_ERROR', 'Campo no permitido: ' + field));
  const items = Array.isArray(body.items) ? body.items : [];
  const quantities = new Map();

  if (!Array.isArray(body.items) || items.length === 0 || items.length > 50) {
    errors.push(error('items', 'INVALID_ITEMS', 'items debe contener entre 1 y 50 elementos'));
  }

  items.forEach((item, index) => {
    const prefix = 'items[' + index + ']';
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(error(prefix, 'INVALID_ITEMS', 'cada item debe ser un objeto'));
      return;
    }
    if (Object.keys(item).some((field) => !['productoId', 'cantidad'].includes(field))) {
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
    value: { items: [...quantities].map(([productoId, cantidad]) => ({ productoId, cantidad })) },
    errors
  };
}

module.exports = { validateOrderPayload };
