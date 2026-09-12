const mongoose = require('mongoose');

const reservationItemSchema = new mongoose.Schema(
  {
    productoId: { type: String, required: true },
    cantidad: { type: Number, required: true, min: 1 }
  },
  { _id: false }
);

const reservaStockSchema = new mongoose.Schema(
  {
    reservationId: { type: String, required: true, unique: true, index: true },
    items: { type: [reservationItemSchema], required: true },
    status: {
      type: String,
      enum: ['pending', 'reserved', 'released'],
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ReservaStock', reservaStockSchema);
