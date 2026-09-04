class InventoryError extends Error {
  constructor(code, message, statusCode = 409) {
    super(message);
    this.name = 'InventoryError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = false;
  }
}

async function rollbackProducts(productModel, items) {
  for (const item of [...items].reverse()) {
    await productModel.updateOne(
      { _id: item.productoId },
      { $inc: { stock: item.cantidad } }
    );
  }
}

function publicReservation(reservation) {
  if (!reservation) return reservation;
  return {
    reservationId: reservation.reservationId,
    items: reservation.items,
    status: reservation.status
  };
}

async function reserveStock({ reservationId, items, productModel, reservationModel }) {
  const existing = await reservationModel.findOne({ reservationId });
  if (existing) {
    if (existing.status === 'reserved') return publicReservation(existing);
    if (existing.status === 'released') {
      throw new InventoryError('RESERVATION_ALREADY_RELEASED', 'La reserva ya fue liberada');
    }
    throw new InventoryError('RESERVATION_IN_PROGRESS', 'La reserva ya está en proceso');
  }

  try {
    await reservationModel.create({
      reservationId,
      items,
      status: 'pending'
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new InventoryError('RESERVATION_IN_PROGRESS', 'La reserva ya está en proceso');
    }
    throw error;
  }

  const applied = [];
  try {
    for (const item of items) {
      const product = await productModel.findOneAndUpdate(
        { _id: item.productoId, stock: { $gte: item.cantidad } },
        { $inc: { stock: -item.cantidad } },
        { new: true, runValidators: true }
      );

      if (!product) {
        const exists = await productModel.findById(item.productoId);
        if (!exists) {
          throw new InventoryError('PRODUCT_NOT_FOUND', 'Producto no encontrado', 404);
        }
        throw new InventoryError(
          'STOCK_INSUFFICIENT',
          'Stock insuficiente para ' + item.productoId,
          409
        );
      }
      applied.push(item);
    }

    const reserved = await reservationModel.findOneAndUpdate(
      { reservationId, status: 'pending' },
      { $set: { status: 'reserved' } },
      { new: true }
    );
    if (!reserved) {
      throw new InventoryError('RESERVATION_STATE_ERROR', 'No se pudo confirmar la reserva', 503);
    }
    return publicReservation(reserved);
  } catch (error) {
    try {
      await rollbackProducts(productModel, applied);
      await reservationModel.deleteOne({ reservationId, status: 'pending' });
    } catch (compensationError) {
      error.compensationError = compensationError;
    }
    throw error;
  }
}

async function releaseStock({ reservationId, productModel, reservationModel }) {
  const reservation = await reservationModel.findOne({ reservationId });
  if (!reservation) {
    throw new InventoryError('RESERVATION_NOT_FOUND', 'Reserva no encontrada', 404);
  }
  if (reservation.status === 'released') return publicReservation(reservation);
  if (reservation.status !== 'reserved') {
    throw new InventoryError('RESERVATION_NOT_READY', 'La reserva no está confirmada');
  }

  await rollbackProducts(productModel, reservation.items);
  const released = await reservationModel.findOneAndUpdate(
    { reservationId, status: 'reserved' },
    { $set: { status: 'released' } },
    { new: true }
  );
  if (!released) {
    throw new InventoryError('RESERVATION_STATE_ERROR', 'No se pudo liberar la reserva', 503);
  }
  return publicReservation(released);
}

module.exports = { InventoryError, reserveStock, releaseStock };
