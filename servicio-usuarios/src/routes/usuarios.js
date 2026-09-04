const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const { logEvent } = require('../observability');
const { validateRegisterPayload, validateLoginPayload } = require('../validation');
const { errorResponse, validationResponse } = require('../errors');
const { createAccessToken } = require('../auth');
const { publicUser } = require('../presentation');

const router = express.Router();

// POST /usuarios/register - registrar un usuario nuevo
router.post('/register', async (req, res) => {
  try {
    const validation = validateRegisterPayload(req.body);
    if (!validation.valid) {
      logEvent('servicio-usuarios', 'warn', 'validation_rejected', {
        correlationId: req.correlationId,
        endpoint: 'register',
        error_count: validation.errors.length
      });
      return validationResponse(res, req, validation.errors);
    }
    const { nombre, email, password, direccion } = validation.value;

    const existente = await Usuario.findOne({ email });
    if (existente) {
      return errorResponse(res, 409, 'EMAIL_ALREADY_REGISTERED', 'Ya existe un usuario con ese email', req);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const usuario = await Usuario.create({ nombre, email, passwordHash, direccion });
    logEvent('servicio-usuarios', 'info', 'user_registered', {
      correlationId: req.correlationId,
      user_id: usuario._id.toString()
    });

    return res.status(201).json(publicUser(usuario));
  } catch (err) {
    if (err && err.code === 11000) {
      return errorResponse(res, 409, 'EMAIL_ALREADY_REGISTERED', 'Ya existe un usuario con ese email', req);
    }
    logEvent('servicio-usuarios', 'error', 'request_failed', {
      correlationId: req.correlationId,
      endpoint: 'register',
      error: err.message
    });
    return errorResponse(res, 500, 'INTERNAL_ERROR', 'Error interno al registrar usuario', req);
  }
});

// POST /usuarios/login - login, devuelve token JWT
router.post('/login', async (req, res) => {
  try {
    const validation = validateLoginPayload(req.body);
    if (!validation.valid) {
      return validationResponse(res, req, validation.errors);
    }
    const { email, password } = validation.value;

    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return errorResponse(res, 401, 'INVALID_CREDENTIALS', 'Credenciales invalidas', req);
    }

    const passwordOk = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordOk) {
      return errorResponse(res, 401, 'INVALID_CREDENTIALS', 'Credenciales invalidas', req);
    }

    const token = createAccessToken(usuario, { jwtImpl: jwt });

    logEvent('servicio-usuarios', 'info', 'user_authenticated', {
      correlationId: req.correlationId,
      user_id: usuario._id.toString()
    });

    return res.json({ token });
  } catch (err) {
    logEvent('servicio-usuarios', 'error', 'request_failed', {
      correlationId: req.correlationId,
      endpoint: 'login',
      error: err.message
    });
    return errorResponse(res, 500, 'INTERNAL_ERROR', 'Error interno al iniciar sesion', req);
  }
});

// GET /usuarios/:id - obtener perfil de un usuario por ID
router.get('/:id', async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.params.id).select('-passwordHash');
    if (!usuario) {
      return errorResponse(res, 404, 'USER_NOT_FOUND', 'Usuario no encontrado', req);
    }
    return res.json(publicUser(usuario));
  } catch (err) {
    if (err.name === 'CastError') {
      return errorResponse(res, 400, 'INVALID_ID', 'ID de usuario invalido', req);
    }
    logEvent('servicio-usuarios', 'error', 'request_failed', {
      correlationId: req.correlationId,
      endpoint: 'get_user',
      error: err.message
    });
    return errorResponse(res, 503, 'USERS_UNAVAILABLE', 'No se pudo consultar el usuario', req);
  }
});

module.exports = router;
