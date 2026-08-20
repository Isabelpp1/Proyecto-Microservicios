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
      enum: ['creado', 'confirmado', 'cancelado'],
      default: 'creado'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Pedido', pedidoSchema);
