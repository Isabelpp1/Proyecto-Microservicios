const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    direccion: { type: String, default: '' }
  },
  { timestamps: true }
);

usuarioSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('Usuario', usuarioSchema);
