# Contratos de API

Todas las rutas públicas se consumen a través de http://localhost:3000. Las rutas internas mostradas para Productos se invocan únicamente desde servicio-pedidos.

## Respuesta de error

```
{
  "error": "Stock insuficiente",
  "code": "STOCK_INSUFFICIENT",
  "correlationId": "demo-001",
  "details": {
    "stockDisponible": 1
  }
}
```

El campo error se mantiene por compatibilidad con Checkpoint 1/2. code permite automatizar clientes y correlationId permite buscar el flujo en logs.

## Salud

| Método | Ruta | Éxito |
|---|---|---|
| GET | /healthz | 200, servicio vivo |
| GET | /api/usuarios/healthz | 200 |
| GET | /api/productos/healthz | 200 |
| GET | /api/pedidos/healthz | 200 |
| GET | /api/usuarios/readyz | 200 si Mongo está listo, 503 si no |
| GET | /api/productos/readyz | 200 si Mongo está listo, 503 si no |
| GET | /api/pedidos/readyz | 200 si Mongo está listo, 503 si no |

## Usuarios

### POST /api/usuarios/register

Body:

```
{
  "nombre": "Ana Lopez",
  "email": "ana@example.com",
  "password": "secreta123",
  "direccion": "Zona 1"
}
```

Devuelve 201 con id, nombre y email. Passwords de menos de 8 o más de 72 caracteres, emails inválidos y campos desconocidos devuelven 400. Email duplicado devuelve 409.

### POST /api/usuarios/login

Body: email y password. Devuelve 200 con token JWT. Credenciales incorrectas devuelven 401. El JWT contiene sub, userId y email y expira según JWT_EXPIRES_IN, cuyo valor por defecto es 2h.

### GET /api/usuarios/:id

Devuelve 200 con id, nombre y email, sin passwordHash. Un usuario inexistente devuelve 404 y un ID inválido devuelve 400.

## Productos

### GET /api/productos

Lista el catálogo y devuelve 200. Si el catálogo no está disponible devuelve 503
`CATALOG_UNAVAILABLE`.

### POST /api/productos

Body: nombre, descripción opcional, precio no negativo y stock entero no negativo. Devuelve 201. Los datos inválidos devuelven 400.

### GET /api/productos/:id

Devuelve un producto o 404 si no existe. Un fallo temporal del catálogo devuelve 503
`CATALOG_UNAVAILABLE`.

### PATCH /api/productos/:id/stock

Endpoint de compatibilidad interna. Requiere x-internal-service-token y body { cantidad: 1 }. Stock insuficiente devuelve 409.

## Pedidos

### POST /api/pedidos

Requiere Authorization: Bearer token. El body es:

```
{
  "items": [
    {
      "productoId": "507f1f77bcf86cd799439011",
      "cantidad": 2
    }
  ]
}
```

usuarioId del body se ignora por compatibilidad; el usuario se toma del JWT. Idempotency-Key es opcional, recomendado para clientes que reintentan.

Respuestas:

| Status | Código típico | Significado |
|---|---|---|
| 201 | - | Pedido confirmado |
| 200 | - | Replay exacto con Idempotency-Key |
| 400 | VALIDATION_ERROR | Body o items inválidos |
| 401 | AUTH_REQUIRED / AUTH_INVALID | JWT ausente o inválido |
| 404 | USER_NOT_FOUND / PRODUCT_NOT_FOUND | Entidad no existe |
| 409 | STOCK_INSUFFICIENT | No hay stock; no se descuenta |
| 409 | IDEMPOTENCY_CONFLICT | Clave reutilizada con otro payload |
| 409 | IDEMPOTENCY_IN_PROGRESS | Solicitud idéntica aún en curso |
| 503 | DEPENDENCY_UNAVAILABLE | Usuario/Productos no disponible |

### GET /api/pedidos

Lista pedidos y admite el filtro opcional usuarioId.

### GET /api/pedidos/:id

Devuelve el pedido o 404 si no existe. Un fallo temporal de la base de pedidos devuelve 503
`ORDERS_UNAVAILABLE`.

## Endpoints internos de Productos

### POST /productos/stock/reserve

Requiere x-internal-service-token. Body { reservationId, items }. Actualiza stock de forma idempotente y devuelve la reserva.

### POST /productos/stock/release

Requiere x-internal-service-token. Body { reservationId }. Libera una reserva confirmada una sola vez.
