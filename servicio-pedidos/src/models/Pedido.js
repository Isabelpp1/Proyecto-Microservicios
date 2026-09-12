const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    productoId: { type: String, required: true },
    nombreProducto: { type: String, required: true },
    cantidad: { type: Number, required: true, min: 1 },
    precioUnitario: { type: Number, required: true }
  },
  { _id: false }
);

const pedidoSchema = new mongoose.Schema(
  {
    usuarioId: { type: String, required: true },
    items: { type: [itemSchema], required: true },
    total: { type: Number, required: true },
    estado: {
      type: String,
      enum: ['creado', 'procesando', 'confirmado', 'cancelado'],
      default: 'creado'
    },
    idempotencyKey: { type: String, default: null },
    requestFingerprint: { type: String, default: null }
  },
  { timestamps: true }
);

pedidoSchema.index(
  { usuarioId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

module.exports = mongoose.model('Pedido', pedidoSchema);
