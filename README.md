# Sistema de pedidos para una tienda en línea

Proyecto del curso de Arquitectura de Componentes y Microservicios. La aplicación está dividida
en tres servicios: usuarios, productos y pedidos. Un API Gateway recibe las solicitudes y las
envía al servicio correspondiente.

El proyecto usa Node.js, Express, MongoDB y Docker Compose. La decisión del stack está documentada
en [`docs/RFC-001.md`](docs/RFC-001.md).

Equipo: Carlos Daniel Martinez, Douglas Pérez e Isabel Paiz.

## Arquitectura

```
Cliente (curl / Postman)
        │  HTTP
        ▼
  API Gateway (Express, puerto 3000)
        │
   ┌────┼─────────────┐
   ▼    ▼              ▼
Usuarios  Productos    Pedidos
:3001     :3002        :3003
   │        │             │  (llama sincronamente a Usuarios y Productos)
   ▼        ▼             ▼
MongoDB   MongoDB       MongoDB
usuarios  productos     pedidos
```

- Cada microservicio tiene **su propia base de datos** (database-per-service): ningún servicio
  consulta directamente la base de datos de otro.
- **Servicio de Pedidos** es el orquestador: al crear un pedido, valida al cliente contra
  **Servicio de Usuarios** y verifica/descuenta existencias contra **Servicio de Productos**,
  ambos vía REST síncrono.
- Todo el tráfico externo entra por el **API Gateway**, que enruta según el path
  (`/api/usuarios`, `/api/productos`, `/api/pedidos`).

## Estructura del repositorio

```
pedidos-tienda-online/
├── api-gateway/          # Punto de entrada único (Express + http-proxy-middleware)
├── servicio-usuarios/     # Registro, login (JWT) y perfil de cliente
├── servicio-productos/    # Catálogo e inventario
├── servicio-pedidos/      # Creación y consulta de pedidos (orquestador)
├── docker-compose.yml
├── .env.example
└── README.md
```

## Cómo correrlo

Se necesita tener Docker Desktop instalado y abierto. No es necesario instalar Node.js para
levantar la versión de Compose, porque cada servicio instala sus dependencias dentro de su
contenedor.

```bash
git clone <repo>
cd pedidos-tienda-online
cp .env.example .env
docker compose up --build
```

En PowerShell, el segundo comando se puede escribir así:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

La primera vez puede tardar un poco mientras Docker descarga MongoDB y construye las imágenes.
Para detener los contenedores se puede presionar `Ctrl+C`. Si se quieren dejar ejecutándose en
segundo plano, usar `docker compose up --build -d`.

Verificar que los 3 servicios y el gateway están arriba:

```bash
curl http://localhost:3000/healthz                 # gateway
curl http://localhost:3000/api/usuarios/healthz     # (o directo: docker exec, o exponer puertos)
```

> Nota: en este checkpoint solo el API Gateway publica su puerto (3000) al host, siguiendo el
> patrón de "único punto de entrada". Para depurar un servicio individual en desarrollo se puede
> exponer temporalmente su puerto en `docker-compose.yml`.

## Flujo de prueba end-to-end (Checkpoint 1)

```bash
# 1. Registrar un usuario
curl -X POST http://localhost:3000/api/usuarios/register \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Ana Lopez","email":"ana@example.com","password":"secreta123"}'

# 2. Iniciar sesión
curl -X POST http://localhost:3000/api/usuarios/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@example.com","password":"secreta123"}'

# 3. Crear un producto en el catálogo
curl -X POST http://localhost:3000/api/productos \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Mouse inalambrico","precio":25.5,"stock":10}'

# 4. Crear un pedido (usa los IDs devueltos en los pasos 1 y 3)
curl -X POST http://localhost:3000/api/pedidos \
  -H "Content-Type: application/json" \
  -d '{"usuarioId":"<id_usuario>","items":[{"productoId":"<id_producto>","cantidad":2}]}'

# 5. Consultar el pedido creado
curl http://localhost:3000/api/pedidos/<id_pedido>
```

En Windows se puede usar `curl.exe` en lugar de `curl` si PowerShell interpreta `curl` como un
alias de `Invoke-WebRequest`. Los valores entre `< >` se deben reemplazar con los IDs que devuelve
la respuesta anterior.

Al crear el pedido, `servicio-pedidos` llama a `servicio-usuarios` (para validar que el cliente
existe) y a `servicio-productos` (para verificar y descontar stock) antes de confirmar el pedido.

## Estado del proyecto

### Checkpoint 1 — Microservicios y Docker
- [x] Tres microservicios independientes (Usuarios, Productos, Pedidos), cada uno con su propia
      base de datos MongoDB.
- [x] Cada servicio expone `/healthz` y `/readyz`.
- [x] `servicio-pedidos` valida usuario y stock vía REST síncrono antes de confirmar un pedido.
- [x] API Gateway como único punto de entrada externo.
- [x] `docker-compose.yml` levanta todo el sistema (`docker compose up --build`).
- [x] Sin passwords ni secretos en el código: todo vía variables de entorno (`.env`, ignorado
      por git).
- [x] Comunicación entre servicios por nombre lógico de contenedor (`http://servicio-usuarios:3001`),
      nunca por IP fija.

### Checkpoint 2 — Seguridad, resiliencia y observabilidad
Planeado para la siguiente entrega:
- **JWT en `servicio-pedidos`**: exigir un token válido (emitido por `servicio-usuarios`) en
  `POST /pedidos`, extrayendo `usuarioId` del token en vez de recibirlo en el body.
- **Resiliencia en las llamadas de `servicio-pedidos`** hacia Usuarios/Productos:
  timeout explícito (ya presente en este checkpoint), reintentos con backoff exponencial + jitter,
  y un circuit breaker simple para no saturar un servicio caído.
- **Logs estructurados en JSON** con `x-correlation-id` propagado entre servicios
  (`correlation_id`, `service`, `event`, `level`, `timestamp`), para poder rastrear un mismo
  request a través de los tres microservicios.
- **Registro/descubrimiento de servicios simple**: evaluar si se incorpora un mecanismo ligero
  de service discovery (por ejemplo Consul en modo dev) o si se documenta explícitamente por qué,
  dado el alcance del proyecto, se mantiene el descubrimiento por nombre de contenedor de Docker
  Compose (decisión ya justificada en el RFC-001).

### Entrega final — Documentación y demo
- README final con arquitectura, instrucciones de instalación/uso y sección de seguridad
  (incluye rotación de credenciales).
- Video demo (5–8 min) mostrando: `docker compose up`, registro/login, creación de pedido válido,
  caso de stock insuficiente, caída simulada de un servicio dependiente y comportamiento del
  sistema, y logs con `correlation_id`.
- Revisión final de que ningún secreto quede en el repositorio.

## Seguridad (estado actual)

- Passwords de usuario hasheados con `bcrypt` antes de guardarse.
- `JWT_SECRET` y credenciales de MongoDB solo viven en `.env` (no versionado).
- Pendiente para Checkpoint 2: exigir y validar el JWT en los endpoints de escritura de
  `servicio-pedidos`.

## Decisiones de arquitectura

Ver `docs/RFC-001.md` para el detalle completo de por qué se eligió Node.js/Express + MongoDB
sobre las alternativas consideradas (Python/FastAPI y Java/Spring Boot).
