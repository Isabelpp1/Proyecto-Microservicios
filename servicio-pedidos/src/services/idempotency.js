const crypto = require('crypto');

class IdempotencyError extends Error {
  constructor(code, message, statusCode = 409) {
    super(message);
    this.name = 'IdempotencyError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = false;
  }
}

function buildOrderFingerprint(items) {
  const canonical = [...items]
    .map((item) => ({
      productoId: String(item.productoId),
      cantidad: Number(item.cantidad)
    }))
    .sort((left, right) => left.productoId.localeCompare(right.productoId));

  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function classifyIdempotency(existing, fingerprint) {
  if (!existing) return { status: 'new' };
  if (existing.requestFingerprint !== fingerprint) return { status: 'conflict' };
  if (existing.status === 'completed' || existing.estado === 'confirmado') {
    return { status: 'replay' };
  }
  return { status: 'in_progress' };
}

async function startIdempotency({ userId, key, fingerprint, model }) {
  let existing = await model.findOne({ usuarioId: userId, key });
  if (existing) {
    const classification = classifyIdempotency(existing, fingerprint);
    if (classification.status === 'conflict') {
      throw new IdempotencyError(
        'IDEMPOTENCY_CONFLICT',
        'La misma Idempotency-Key se usó con otro pedido'
      );
    }
    return { ...classification, record: existing };
  }

  try {
    const record = await model.create({
      usuarioId: userId,
      key,
      requestFingerprint: fingerprint,
      status: 'processing',
      orderId: null
    });
    return { status: 'new', record };
  } catch (error) {
    if (error.code !== 11000) throw error;
    existing = await model.findOne({ usuarioId: userId, key });
    if (!existing) throw error;
    const classification = classifyIdempotency(existing, fingerprint);
    if (classification.status === 'conflict') {
      throw new IdempotencyError(
        'IDEMPOTENCY_CONFLICT',
        'La misma Idempotency-Key se usó con otro pedido'
      );
    }
    return { ...classification, record: existing };
  }
}

module.exports = {
  IdempotencyError,
  buildOrderFingerprint,
  classifyIdempotency,
  startIdempotency
};
