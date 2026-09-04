class OrderBusinessError extends Error {
  constructor(code, message, statusCode = 409, details) {
    super(message);
    this.name = 'OrderBusinessError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.retryable = false;
  }
}

async function buildOrderDetails(items, getProduct) {
  const detailedItems = [];
  let total = 0;

  for (const item of items) {
    const product = await getProduct(item.productoId);
    if (!product) {
      throw new OrderBusinessError(
        'PRODUCT_NOT_FOUND',
        'Producto ' + item.productoId + ' no existe',
        404
      );
    }
    if (product.stock < item.cantidad) {
      throw new OrderBusinessError(
        'STOCK_INSUFFICIENT',
        'Stock insuficiente para ' + product.nombre,
        409,
        { stockDisponible: product.stock, productoId: item.productoId }
      );
    }

    detailedItems.push({
      productoId: product._id,
      nombreProducto: product.nombre,
      cantidad: item.cantidad,
      precioUnitario: product.precio
    });
    total += product.precio * item.cantidad;
  }

  return {
    items: detailedItems,
    total: Math.round((total + Number.EPSILON) * 100) / 100
  };
}

module.exports = { OrderBusinessError, buildOrderDetails };
