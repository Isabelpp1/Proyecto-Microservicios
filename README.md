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
Usuarios  Productos    Pedidos ── consulta y registra ──► Consul :8500
:3001     :3002        :3003
   │        │             │  (resuelve Usuarios y Productos mediante Consul)
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
- Consul corre únicamente en modo desarrollo local. Los tres microservicios se registran al
  iniciar y Pedidos descubre instancias saludables de Usuarios y Productos antes de llamarlas.

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

Verificar que los servicios y el gateway están arriba:

```bash
curl http://localhost:3000/healthz                 # gateway
curl http://localhost:3000/api/usuarios/healthz     # (o directo: docker exec, o exponer puertos)
```

La interfaz de Consul está disponible en [http://localhost:8500](http://localhost:8500). Allí deben
aparecer `servicio-usuarios`, `servicio-productos` y `servicio-pedidos` como saludables.

> Nota: en este checkpoint solo el API Gateway publica su puerto (3000) al host, siguiendo el
> patrón de "único punto de entrada". Para depurar un servicio individual en desarrollo se puede
> exponer temporalmente su puerto en `docker-compose.yml`.

## Flujo de prueba end-to-end (Checkpoint 2)

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

# 4. Crear un pedido protegido (usa el token de login y el ID de producto)
#    El usuario se obtiene exclusivamente desde el JWT.
curl -X POST http://localhost:3000/api/pedidos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token_jwt>" \
  -H "x-correlation-id: demo-pedido-001" \
  -d '{"items":[{"productoId":"<id_producto>","cantidad":2}]}'

# 5. Consultar el pedido creado
curl http://localhost:3000/api/pedidos/<id_pedido>
```

En Windows se puede usar `curl.exe` en lugar de `curl` si PowerShell interpreta `curl` como un
alias de `Invoke-WebRequest`. Los valores entre `< >` se deben reemplazar con los IDs que devuelve
la respuesta anterior.

Sin token, token expirado o token inválido, `POST /api/pedidos` responde `401`. El campo
`usuarioId` ya no se acepta en el body. Al crear un pedido, `servicio-pedidos` llama a
`servicio-usuarios` y a `servicio-productos` a través de instancias descubiertas en Consul.

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
- [x] `POST /api/pedidos` exige Bearer JWT y toma el usuario desde el token.
- [x] Consul en modo desarrollo registra Usuarios, Productos y Pedidos; Pedidos descubre las
      dependencias saludables por nombre de servicio.
- [x] Llamadas con timeout de 2 segundos, hasta 3 reintentos (backoff 0.5 s, 1 s, 2 s + jitter)
      y circuit breaker independiente por dependencia (3 fallos, 30 s abierto).
- [x] Si una dependencia falla o su circuito está abierto, el pedido se rechaza con `503`; no se
      crea el pedido ni se descuenta inventario.
- [x] Logs JSON y propagación de `x-correlation-id` entre Gateway, Pedidos y dependencias.

## Observabilidad y prueba de resiliencia

Cada request conserva el header `x-correlation-id` recibido o genera uno nuevo. Para seguir un
pedido en todos los servicios:

```powershell
docker compose logs --no-color | Select-String 'demo-pedido-001'
```

Para simular una dependencia caída, con un JWT y producto válidos, ejecutar tres veces el mismo
`POST /api/pedidos` después de detener Productos:

```powershell
docker compose stop servicio-productos
# enviar el pedido tres veces: cada respuesta es 503 y registra reintentos
# el cuarto intento se rechaza inmediatamente porque el circuito está abierto
docker compose start servicio-productos
# esperar 30 segundos y enviar de nuevo el pedido: el circuito permite una prueba y se recupera
```

La secuencia completa y solicitudes listas para importar están en
[`docs/GUIA_CHECKPOINT_2.md`](docs/GUIA_CHECKPOINT_2.md) y
[`docs/Checkpoint2.postman_collection.json`](docs/Checkpoint2.postman_collection.json).

### Entrega final — Documentación y demo
- README final con arquitectura, instrucciones de instalación/uso y sección de seguridad
  (incluye rotación de credenciales).
- Video demo (5–8 min) mostrando: `docker compose up`, registro/login, creación de pedido válido,
  caso de stock insuficiente, caída simulada de un servicio dependiente y comportamiento del
  sistema, y logs con `correlation_id`.
- Revisión final de que ningún secreto quede en el repositorio.

## Seguridad y rotación de secretos

- Passwords de usuario hasheados con `bcrypt` antes de guardarse.
- `JWT_SECRET` y credenciales de MongoDB solo viven en `.env` (no versionado).
- Para rotar un secreto: genere un valor nuevo, actualice `JWT_SECRET` en `.env` y reinicie
  `servicio-usuarios` y `servicio-pedidos` con `docker compose up -d --force-recreate`.
  Los tokens emitidos con el secreto anterior quedarán inválidos, por lo que los usuarios deben
  iniciar sesión de nuevo. Nunca suba `.env` ni comparta ese valor en la colección Postman.

## Decisiones de arquitectura

Ver `docs/RFC-001.md` para el detalle completo de por qué se eligió Node.js/Express + MongoDB
sobre las alternativas consideradas (Python/FastAPI y Java/Spring Boot).
