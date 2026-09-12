# Checkpoint final - Mejoras respecto al Checkpoint 2

## Objetivo de la entrega

Conservar todo lo construido en los dos primeros checkpoints y convertirlo en una entrega reproducible,
verificable y demostrable. El dominio sigue siendo el sistema de gestión de pedidos definido por RFC-001.

## Cambios principales

| Área | Estado en Checkpoint 2 | Estado final |
|---|---|---|
| Validación | Validación parcial por endpoint. | Tipos, rangos, ObjectId, campos desconocidos, cantidades, tamaño de JSON y normalización. |
| Errores | Respuestas variables. | Envelope con `error`, `code`, `correlationId` y `details` opcional. |
| Seguridad | JWT para Pedidos y secretos por entorno. | JWT con claims estándar, validación de secretos al iniciar, token interno para stock y headers de seguridad. |
| Stock | Descuento secuencial. | Reserva agregada, actualización atómica con predicado de stock, rollback y liberación idempotente. |
| Pedido | Sin protección completa contra reintentos. | `Idempotency-Key`, huella estable, replay `200`, conflicto `409` y estado en curso controlado. |
| Fallo parcial | Reintentos ante dependencia caída. | No se confirma pedido si falta una dependencia; se libera la reserva si falla la persistencia. |
| Observabilidad | Logs JSON y correlación técnica. | Eventos de negocio, retries, circuito abierto, reserva, release, replay y sanitización de IDs. |
| Salud | Health/readiness disponibles. | Readiness conectado a Mongo, health checks de Compose y deregistro limpio en Consul. |
| Experiencia | Principalmente Postman/curl. | UI HTML/CSS/JavaScript servida por el Gateway, sin crear un nuevo bounded context. |
| Pruebas | Tests concentrados en funcionalidad previa. | Unitarias en los cuatro componentes, contrato frontend, smoke E2E y prueba de dependencia caída. |
| Entrega | README y colecciones anteriores. | README raíz, índice de docs, arquitectura, API, matriz, guías y colección CP3. |
| CI | Validación básica. | GitHub Actions ejecuta tests, sintaxis de `src/test/public` cuando existe y `docker compose config`. |

## Flujo final de un pedido

```text
1. UI o cliente -> Gateway: POST /api/pedidos + JWT + Idempotency-Key opcional
2. Gateway asigna/propaga correlation ID
3. Pedidos valida payload e identity del JWT
4. Pedidos descubre Usuarios en Consul y valida al usuario
5. Pedidos descubre Productos y obtiene snapshots de precio/stock
6. Productos reserva todos los items de forma atómica e idempotente
7. Pedidos guarda el pedido confirmado y cierra la idempotencia
8. Si falla la persistencia, Pedidos solicita release de la reserva
9. El Gateway devuelve resultado, código y correlation ID
```

## Contrato de resultados importantes

| Escenario | Resultado | Garantía |
|---|---|---|
| Pedido válido | `201` | Pedido confirmado y stock reservado/descontado. |
| Replay exacto | `200` | Mismo pedido y sin segundo descuento. |
| JWT ausente o inválido | `401` | No se crea pedido ni se consulta inventario. |
| Stock insuficiente | `409 STOCK_INSUFFICIENT` | No hay descuento parcial ni nuevo pedido. |
| Dependencia caída | `503 DEPENDENCY_UNAVAILABLE` | No se confirma pedido; la operación queda rechazada. |
| Idempotency-Key con otro payload | `409 IDEMPOTENCY_CONFLICT` | No se reutiliza una clave para otra operación. |

## Interfaz visual

La UI se sirve desde `api-gateway/public` en `http://localhost:3000`. Permite registrar, iniciar sesión,
ver productos, consultar stock, usar un carrito, crear pedidos, repetirlos y visualizar errores. El
cliente no conoce puertos internos ni tokens de servicio; consume únicamente las rutas del Gateway.

## Verificación final

```powershell
docker compose config
docker compose up --build -d
docker compose ps
node test/integration-smoke.js
```

La batería final debe incluir pruebas unitarias, sintaxis, contrato de Compose, smoke E2E y una caída
controlada de Productos. El detalle operativo está en [docs/README.md](README.md) y el recorrido del
video en [GUIA_DEMO_FINAL.md](GUIA_DEMO_FINAL.md).

## Decisiones de alcance

No se agregaron roles administrativos porque RFC-001 no define ese actor. Tampoco se agregaron pagos,
notificaciones, RabbitMQ, MCP, A2A ni cloud. Esas capacidades pertenecen al ejemplo FitFlow o a puntos
extra del PDF, no al dominio de pedidos evaluado en tres checkpoints.

