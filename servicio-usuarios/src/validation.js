const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGISTER_FIELDS = new Set(['nombre', 'email', 'password', 'direccion']);

function error(field, code, message) {
  return { field, code, message };
}

function unknownFields(payload, allowedFields) {
  return Object.keys(payload || {})
    .filter((field) => !allowedFields.has(field))
    .map((field) => error(field, 'VALIDATION_ERROR', 'Campo no permitido: ' + field));
}

function validateRegisterPayload(payload) {
  const body = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const errors = unknownFields(body, REGISTER_FIELDS);
  const value = {
    nombre: typeof body.nombre === 'string' ? body.nombre.trim() : body.nombre,
    email: typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email,
    password: body.password,
    direccion: body.direccion === undefined
      ? ''
      : typeof body.direccion === 'string' ? body.direccion.trim() : body.direccion
  };

  if (typeof value.nombre !== 'string' || value.nombre.length < 2 || value.nombre.length > 100) {
    errors.push(error('nombre', 'VALIDATION_ERROR', 'nombre debe tener entre 2 y 100 caracteres'));
  }
  if (typeof value.email !== 'string' || value.email.length > 254 || !EMAIL_PATTERN.test(value.email)) {
    errors.push(error('email', 'INVALID_EMAIL', 'email debe tener un formato válido'));
  }
  if (typeof value.password !== 'string' || value.password.length < 8 || value.password.length > 72) {
    errors.push(error('password', 'INVALID_CREDENTIALS', 'password debe tener entre 8 y 72 caracteres'));
  }
  if (typeof value.direccion !== 'string' || value.direccion.length > 200) {
    errors.push(error('direccion', 'VALIDATION_ERROR', 'direccion debe tener como máximo 200 caracteres'));
  }

  return { valid: errors.length === 0, value, errors };
}

function validateLoginPayload(payload) {
  const body = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const errors = unknownFields(body, new Set(['email', 'password']));
  const value = {
    email: typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email,
    password: body.password
  };

  if (typeof value.email !== 'string' || value.email.length > 254 || !EMAIL_PATTERN.test(value.email)) {
    errors.push(error('email', 'INVALID_CREDENTIALS', 'Credenciales inválidas'));
  }
  if (typeof value.password !== 'string' || value.password.length === 0 || value.password.length > 72) {
    errors.push(error('password', 'INVALID_CREDENTIALS', 'Credenciales inválidas'));
  }

  return { valid: errors.length === 0, value, errors };
}

module.exports = { validateRegisterPayload, validateLoginPayload };
