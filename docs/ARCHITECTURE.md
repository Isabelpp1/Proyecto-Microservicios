# Arquitectura del sistema de pedidos - Checkpoint final

## Alcance

El dominio real es un sistema de gestión de pedidos para una tienda en línea. La fuente de verdad es RFC-001. Los nombres y bounded contexts del PDF de FitFlow se utilizan únicamente para comparar nivel de madurez y no forman parte de esta aplicación.

## Vista de componentes

```
Cliente / Postman / curl
            |
            v
    API Gateway :3000
            |
    +-------+---------+
    |       |         |
    v       v         v
 Usuarios  Productos  Pedidos
 :3001     :3002      :3003
    |       |         |
    v       v         v
 Mongo     Mongo     Mongo
 usuarios  productos pedidos

 Consul :8500 registra y verifica los tres servicios.
 Pedidos consulta Consul para resolver Usuarios y Productos.
```

El cliente conoce únicamente el Gateway. Los servicios se comunican por los nombres lógicos de Docker y Pedidos usa descubrimiento dinámico para sus dependencias.

## Responsabilidades y propiedad de datos

| Componente | Responsabilidad | Base de datos propia |
|---|---|---|
| API Gateway | Entrada HTTP, correlation ID, headers de seguridad y proxy | No |
| Usuarios | Registro, hash bcrypt, login JWT y perfil público | mongo-usuarios / usuarios_db |
| Productos | Catálogo, precios, stock y reservas de inventario | mongo-productos / productos_db |
| Pedidos | Orquestación, cálculo de total, idempotencia y consulta de pedidos | mongo-pedidos / pedidos_db |
| Consul | Registro, health checks y discovery | Estado interno de Consul |

Ningún servicio consulta directamente la base de otro servicio.

## Flujo de creación de pedido

```
1. Cliente -> Gateway: POST /api/pedidos + Bearer JWT
2. Gateway -> Pedidos: conserva x-correlation-id
3. Pedidos -> Consul: resuelve servicio-usuarios
4. Pedidos -> Usuarios: valida que el usuario exista
5. Pedidos -> Consul: resuelve servicio-productos
6. Pedidos -> Productos: obtiene precios y stock actuales
7. Pedidos -> Productos: reserva todos los items con reservationId
8. Productos: actualiza stock con predicado stock >= cantidad
9. Pedidos: persiste el pedido confirmado
10. Si falla persistencia: Productos libera la reserva
```

Antes de reservar se validan todos los items. Productos consolida productos repetidos y revierte los decrementos anteriores si un item no puede reservarse. Así un rechazo de negocio no deja descuento parcial.

## Consistencia e idempotencia

Idempotency-Key es opcional para mantener compatibilidad con Checkpoint 1/2. Cuando se envía:

- Se calcula una huella SHA-256 de los items normalizados y ordenados.
- La misma clave y la misma huella devuelve el pedido existente con status 200.
- La misma clave con otra huella devuelve 409 IDEMPOTENCY_CONFLICT.
- Una solicitud en curso devuelve 409 IDEMPOTENCY_IN_PROGRESS.
- Si la operación falla antes de completar, se elimina el registro de procesamiento cuando el stock quedó compensado.

La reserva de Productos también es idempotente por reservationId y la liberación no restaura stock dos veces.

## Resiliencia

Pedidos conserva una política independiente por dependencia:

- Timeout HTTP: 2 segundos.
- Retries: hasta tres reintentos, delays base 0.5, 1 y 2 segundos, con jitter.
- Circuit breaker: tres fallos, abierto 30 segundos y una prueba half-open.
- Errores 4xx de negocio no se reintentan.
- Errores de transporte, timeout, 408, 429 y 5xx sí pueden reintentarse.

Si Usuarios o Productos no están disponibles, la respuesta es 503 y no se confirma el pedido. Esta es la adaptación correcta del patrón de resiliencia del PDF: en nuestro dominio ambas dependencias son críticas para aceptar el pedido y no existe un bounded context de notificaciones que pueda quedar pendiente.

## Seguridad

- JWT se firma en Usuarios con JWT_SECRET y contiene sub, userId y email.
- Pedidos exige Bearer JWT para crear pedidos.
- Operaciones de reserva/liberación y el endpoint de descuento compatible requieren x-internal-service-token.
- Passwords se almacenan con bcrypt.
- Secretos, credenciales Mongo y tokens internos llegan por variables de entorno.
- Los cuerpos JSON tienen límite configurable.
- Se envían headers contra sniffing, framing y referrer leakage.
- No se agregan roles administrativos porque RFC-001 no define ese actor.

## Observabilidad

Cada request conserva o genera x-correlation-id y lo devuelve en la respuesta. Los logs son JSON con correlation_id, service, event, level y timestamp. También se registran validaciones rechazadas, retries, circuitos abiertos, reservas, liberaciones, replay y confirmaciones.

Consul llama a /healthz cada 10 segundos y elimina servicios críticos después de 30 segundos. /readyz comprueba la conexión Mongo. En SIGTERM/SIGINT el servicio detiene sus retries y solicita deregistro en Consul.

## Adaptación del PDF

El PDF exige MCP y A2A para el dominio FitFlow. RFC-001 no define agentes, clases, reservas fitness ni notificaciones, y el curso evalúa el sistema de pedidos en tres checkpoints. Por ello se implementan los conceptos transferibles - discovery, resiliencia, logs, seguridad, pruebas y entrega - y se dejan MCP, A2A, notificaciones y cloud como extensiones documentadas, no como funcionalidades inventadas.
