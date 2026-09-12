# Checkpoint Final - Diseño aprobado

## Objetivo

Elevar el sistema de pedidos existente en codex/checkpoint2 a una entrega final reproducible, segura y demostrable, conservando Node.js, Express, MongoDB, Docker Compose, Gateway, Consul, JWT y los bounded contexts de Usuarios, Productos y Pedidos definidos en docs/RFC-001.md.

## Fuente de alcance

docs/RFC-001.md es la fuente principal del dominio y del stack. El PDF proyecto-FitFlow_Proyecto_Mejorado.pdf se usa únicamente como referencia de profundidad: validación, resiliencia, observabilidad, seguridad, documentación, demostración y prácticas de entrega. Los nombres FitFlow, users-svc, booking-svc y notif-svc no se incorporan al producto.

## Decisiones de adaptación

| Tema del PDF | Adaptación al sistema de pedidos | Decisión |
|---|---|---|
| Tres servicios con BD propia | Usuarios, Productos y Pedidos con una base Mongo por servicio | Se conserva y se refuerza |
| Registry y discovery | Consul registra los tres servicios y Pedidos resuelve Usuarios/Productos | Se conserva; se agrega deregistro limpio |
| Resiliencia de notif-svc | Usuarios y Productos son dependencias críticas para aceptar un pedido | Si fallan, se responde 503 sin pedido ni descuento; no se inventa un servicio de notificaciones |
| Outbox de notificaciones | No existe bounded context de notificaciones en el RFC | Queda documentado como fuera de alcance; la consistencia se resuelve con reserva/liberación de inventario e idempotencia |
| MCP | No existe integración de agentes en el RFC ni en el curso de tres checkpoints | Fuera de alcance; se deja como extensión futura detrás del Gateway |
| A2A | No existe un dominio de agentes especializados | Fuera de alcance; agregarlo sería inventar un bounded context |
| Cloud | El RFC y la entrega actual requieren Compose local reproducible | Fuera de alcance opcional; se agrega CI local, no despliegue externo |

## Arquitectura final

El cliente continúa entrando por el API Gateway en localhost:3000. Gateway agrega o conserva x-correlation-id, aplica límites y headers de seguridad, y enruta a los servicios por nombres lógicos de Compose. Cada servicio posee su conexión Mongo exclusiva. Pedidos valida el usuario por REST descubierto en Consul, obtiene la fotografía de precios/stock de Productos, solicita una reserva agregada de inventario y finalmente persiste el pedido.

La reserva de stock se realiza en una única operación de dominio de Productos. El endpoint interno recibe un reservationId, consolida cantidades por producto, actualiza únicamente documentos con stock suficiente y guarda el resultado idempotente. En caso de error de negocio, revierte cualquier decremento de esa operación antes de responder. Si Pedidos no logra persistir después de reservar, solicita liberar la reserva. Las llamadas internas usan INTERNAL_SERVICE_TOKEN; ningún cliente público debe conocerlo.

## Contratos y compatibilidad

- POST /api/usuarios/register y POST /api/usuarios/login mantienen sus cuerpos y códigos actuales.
- El JWT conserva userId y email, y agrega el claim estándar sub.
- POST /api/pedidos conserva { items: [{ productoId, cantidad }] }; usuarioId del body sigue ignorándose y el usuario proviene del JWT.
- Idempotency-Key es opcional para no romper clientes de Checkpoint 1/2; cuando se envía, la repetición exacta devuelve el pedido existente sin volver a reservar stock y un payload distinto recibe 409.
- Los errores conservan el campo error y agregan code, correlationId y, cuando aplica, details.
- Las rutas de lectura existentes se conservan. Las operaciones internas nuevas de reserva/liberación requieren el token de servicio.

## Seguridad

- Secretos, credenciales Mongo y el token interno llegan exclusivamente desde .env/Compose environment; .env continúa ignorado.
- El arranque falla si faltan secretos obligatorios o si JWT_SECRET no supera la longitud mínima documentada.
- Passwords mantienen hash bcrypt.
- Pedidos continúa exigiendo JWT para crear pedidos.
- Productos protege reserva/liberación de stock con token interno.
- Se agregan límites de body, validación estricta de tipos/rangos/IDs, headers de seguridad y CORS configurable.
- No se agrega un rol administrativo porque el RFC no define ese actor ni permisos de catálogo.

## Resiliencia y observabilidad

Se conservan timeout de 2 segundos, retries con backoff 0.5/1/2 segundos más jitter y circuit breaker por dependencia. Se corrigen los caminos de error para clasificar fallos de transporte/5xx como retryables, no reintentar errores de negocio y reportar siempre el correlation_id. Los eventos JSON incluyen request, negocio, dependencia, reserva y resultado. Health/readiness mantienen rutas compatibles y el servicio se desregistra de Consul durante apagado limpio.

## Pruebas y entrega

- Unitarias: validadores, autenticación, idempotencia, reserva/liberación, retry, circuit breaker, discovery y observabilidad.
- Integración: rutas de Productos con Mongo real durante Compose y flujo pedido-reserva-liberación.
- E2E smoke: Gateway -> Usuarios -> Productos -> Pedidos, login, autorización, pedido válido, stock insuficiente, dependencia caída, Consul y health checks.
- CI: sintaxis, tests por servicio y docker compose config con .env.example.
- Documentación: arquitectura, contratos API, matriz PDF/RFC, guía de Checkpoint 3, demo, secretos y colección Postman final.

## Criterios de aceptación

1. feature/checkpoint-final parte de codex/checkpoint2 y no usa worktree.
2. docker compose config termina correctamente con configuración de ejemplo.
3. Los servicios arrancan con docker compose up --build y aparecen saludables en Consul.
4. Un pedido válido devuelve 201, guarda usuario del JWT y descuenta stock.
5. JWT ausente/inválido devuelve 401 y no llama dependencias.
6. Stock insuficiente, IDs inválidos y payloads inválidos devuelven errores 4xx consistentes sin crear pedido ni descontar stock.
7. Una dependencia caída devuelve 503, respeta timeout/retries/circuit breaker y no crea pedido ni deja decremento parcial.
8. Una repetición con la misma Idempotency-Key no crea otro pedido ni descuenta dos veces.
9. Los comandos de pruebas, sintaxis, Compose, smoke E2E y git diff --check quedan documentados y ejecutables.
