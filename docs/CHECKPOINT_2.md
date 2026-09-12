# Checkpoint 2 - Seguridad, discovery y resiliencia

## Punto de partida

El Checkpoint 2 conserva los tres bounded contexts de RFC-001 y la infraestructura del Checkpoint 1.
Su objetivo fue hacer que las llamadas entre servicios fueran protegidas, dinámicas y observables.

## Cambios respecto al Checkpoint 1

| Área | Checkpoint 1 | Mejora del Checkpoint 2 |
|---|---|---|
| Autorización | El pedido podía identificarse con `usuarioId` en el body. | Pedidos exige `Authorization: Bearer <JWT>` y toma el usuario validado del token. |
| Identidad | Datos de usuario enviados por el cliente. | Usuarios emite JWT con claims `sub`, `userId` y `email`; el cliente no decide el usuario del pedido. |
| Discovery | URLs/configuración estática para llamadas internas. | Usuarios, Productos y Pedidos se registran en Consul y Pedidos resuelve instancias saludables. |
| Fallos transitorios | Una dependencia caída podía bloquear el flujo directamente. | Pedidos aplica timeout, retries con backoff/jitter y circuit breaker por dependencia. |
| Observabilidad | Logs de aplicación sin correlación uniforme. | Todos los servicios generan o propagan `x-correlation-id` y escriben logs JSON. |
| Salud | Comprobaciones básicas. | Se formalizan `/healthz`, `/readyz` y los health checks de Compose/Consul. |

## Flujo interno

```text
Cliente
  |
  v
Gateway -- x-correlation-id --> Pedidos
                                  |
                                  +--> Consul --> Usuarios
                                  |
                                  +--> Consul --> Productos
```

Pedidos no lee las bases de Usuarios ni Productos. Consulta sus APIs usando la instancia que Consul
reporta como saludable.

## Seguridad JWT

1. Usuarios registra el usuario y almacena el password con bcrypt.
2. Usuarios valida las credenciales en login y firma el JWT con `JWT_SECRET`.
3. Pedidos valida firma y expiración en cada creación de pedido.
4. Un token ausente, vacío, inválido o expirado responde `401`.
5. El `usuarioId` enviado por clientes antiguos se ignora; el identity source es el JWT.

## Consul y descubrimiento

Cada servicio se registra con nombre lógico, dirección, puerto y health check. Consul consulta
`/healthz` periódicamente y elimina una instancia crítica después del periodo configurado. Pedidos
consulta únicamente instancias `passing=true` y se desregistra durante el apagado.

Comprobación manual:

```powershell
docker compose up --build -d
docker compose ps
Invoke-RestMethod 'http://localhost:8500/v1/health/service/servicio-usuarios?passing=true'
Invoke-RestMethod 'http://localhost:8500/v1/health/service/servicio-productos?passing=true'
Invoke-RestMethod 'http://localhost:8500/v1/health/service/servicio-pedidos?passing=true'
```

## Resiliencia

La política de llamadas externas de Pedidos incluye:

- timeout HTTP de 2 segundos;
- hasta tres reintentos para errores transitorios;
- backoff base de 0.5, 1 y 2 segundos con jitter;
- circuit breaker después de tres fallos, abierto durante 30 segundos;
- no reintentar errores de negocio como `400`, `401`, `404` o `409`.

Usuarios y Productos son dependencias críticas del pedido. Por eso una caída responde `503` y no
confirma un pedido incompleto.

## Logs y correlation ID

El Gateway genera o conserva `x-correlation-id`, lo devuelve en la respuesta y lo propaga a los
servicios. Los eventos JSON incluyen `correlation_id`, `service`, `event`, `level` y `timestamp`.

```powershell
docker compose logs --no-color | Select-String '<correlation_id>'
```

Esto permite seguir una solicitud desde el Gateway hasta Pedidos y sus dependencias.

## Lo que quedaba pendiente para la entrega final

El Checkpoint 2 resolvía comunicación y resiliencia, pero aún necesitaba:

- validación estricta y errores consistentes para clientes;
- protección explícita de endpoints internos de stock;
- idempotencia de pedidos y replay seguro;
- reserva atómica de inventario y compensación ante fallos parciales;
- pruebas unitarias en todos los componentes, integración y E2E;
- interfaz visual, documentación ampliada, colección final y CI.

## Relación con el PDF

Este checkpoint cubre los conceptos transferibles del Task 2A y del Task 3 del PDF: Consul,
discovery, health checks, timeout, retries, circuit breaker, logs JSON y correlation ID. El PDF habla
de `booking-svc` y `notif-svc`; en este proyecto se adaptan a Pedidos y sus dependencias reales,
Usuarios y Productos.

