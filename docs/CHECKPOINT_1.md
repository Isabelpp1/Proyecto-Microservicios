# Checkpoint 1 - Base de microservicios

## Objetivo

Construir un sistema de gestión de pedidos para una tienda en línea con tres microservicios
independientes, una base de datos por servicio, un API Gateway y una configuración reproducible con
Docker Compose.

El dominio no es FitFlow. De acuerdo con [RFC-001](RFC-001.md), los bounded contexts son:

- **Usuarios:** registro, autenticación y perfil público.
- **Productos:** catálogo, precios y stock.
- **Pedidos:** creación, consulta y cálculo del total.

## Qué quedó construido

| Capacidad | Implementación del Checkpoint 1 |
|---|---|
| Servicios independientes | `servicio-usuarios`, `servicio-productos` y `servicio-pedidos` tienen código, Dockerfile y proceso propios. |
| Entrada única | `api-gateway` expone el puerto 3000 y enruta las APIs públicas. |
| Database per Service | `mongo-usuarios`, `mongo-productos` y `mongo-pedidos` almacenan exclusivamente los datos de su servicio. |
| Usuarios | Registro, login y consulta de perfil. Las contraseñas se almacenan con hash bcrypt. |
| Productos | Alta, listado, consulta y operaciones básicas de stock. |
| Pedidos | Creación, consulta, cálculo de total, validación de usuario/producto y descuento de stock. |
| Comunicación | El cliente usa el Gateway y los servicios se comunican por nombres lógicos de Docker. |
| Configuración | Puertos, Mongo URI y credenciales se reciben desde variables de entorno. |
| Operación | Docker Compose levanta servicios, bases y health checks locales. |

## Flujo funcional del primer checkpoint

```text
Cliente -> API Gateway -> Usuarios -> mongo-usuarios
                     -> Productos -> mongo-productos
                     -> Pedidos -> mongo-pedidos
```

El pedido inicial se identificaba con `usuarioId` y sus `items` en el body. El login ya estaba
disponible, pero el uso obligatorio del JWT para autorizar Pedidos se formalizó en el Checkpoint 2.

El flujo mínimo era:

1. Registrar usuario.
2. Iniciar sesión.
3. Crear producto con precio y stock.
4. Crear pedido con usuario, producto y cantidad.
5. Consultar el pedido y comprobar el total.
6. Intentar una cantidad superior al stock.

## Evidencia de revisión

```powershell
docker compose config
docker compose up --build
```

Con Compose activo, el Gateway permite comprobar:

```powershell
curl.exe http://localhost:3000/healthz
curl.exe http://localhost:3000/api/usuarios/healthz
curl.exe http://localhost:3000/api/productos/healthz
curl.exe http://localhost:3000/api/pedidos/healthz
```

La interfaz final también permite recorrer el mismo flujo sin usar Postman.

## Relación con el PDF de referencia

El Task 1 del PDF pide tres servicios, Docker Compose, health checks, variables de entorno, nombres
lógicos y una base de datos por servicio. El proyecto cumple ese nivel con una adaptación intencional:

- El PDF propone PostgreSQL por servicio.
- RFC-001 selecciona MongoDB/Mongoose por experiencia del equipo y el alcance del curso.
- La propiedad de datos y el aislamiento entre servicios se mantienen.

## Límites del checkpoint

El primer checkpoint no resolvía todavía de forma completa:

- autorización JWT obligatoria para crear pedidos;
- discovery dinámico mediante Consul;
- retries, timeouts y circuit breaker;
- correlation ID y logs JSON;
- validación estricta y envelope uniforme de errores;
- idempotencia y reserva compensable de stock;
- pruebas E2E, CI y una interfaz visual.

Esas mejoras se incorporaron progresivamente en los checkpoints siguientes.

