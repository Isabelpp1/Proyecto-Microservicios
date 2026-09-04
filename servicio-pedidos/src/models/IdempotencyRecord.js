const mongoose = require('mongoose');

const idempotencyRecordSchema = new mongoose.Schema(
  {
    usuarioId: { type: String, required: true },
    key: { type: String, required: true },
    requestFingerprint: { type: String, required: true },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      required: true,
      default: 'processing'
    },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pedido', default: null }
  },
  { timestamps: true }
);

idempotencyRecordSchema.index({ usuarioId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('IdempotencyRecord', idempotencyRecordSchema);
