# Guía para revisar el proyecto y el Checkpoint 1

Esta guía la dejamos para que cualquiera del equipo pueda preparar su computadora, levantar el proyecto y comprobar que el primer checkpoint funciona.

## Requisitos

El proyecto se levanta con Docker Compose. No hace falta instalar MongoDB directamente ni instalar las dependencias de Node.js para usar los contenedores.

En Windows necesitamos Docker Desktop, WSL 2, Git y PowerShell.

```powershell
git --version
docker --version
docker compose version
wsl --version
docker info
```

Si algún comando no existe, falta instalarlo o agregarlo al `PATH`. Docker Desktop debe estar abierto. Si `docker info` muestra que no puede conectarse al daemon, hay que esperar a que Docker termine de iniciar.

## Preparar el repositorio

```powershell
git clone <URL_DEL_REPOSITORIO>
cd pedidos-tienda-online
Copy-Item .env.example .env
Get-Content .env
git status --short
git check-ignore .env
```

Para una prueba local, los valores de `.env.example` son suficientes. Antes de usar el proyecto fuera de una prueba, debemos cambiar `JWT_SECRET` por un valor largo y aleatorio. `.env` no debe subirse a Git; `git check-ignore .env` debe mostrarlo como ignorado.

## Validar y levantar Docker Compose

```powershell
docker compose config
docker compose up --build
```

Para dejarlo corriendo en segundo plano:

```powershell
docker compose up --build -d
docker compose ps
```

Deberían aparecer `mongo-usuarios`, `mongo-productos`, `mongo-pedidos`, `servicio-usuarios`, `servicio-productos`, `servicio-pedidos` y `api-gateway`, todos en estado `running` o `Up`.

Si alguno se detiene, revisar sus logs:

```powershell
docker compose logs --tail=100 servicio-usuarios
docker compose logs --tail=100 servicio-productos
docker compose logs --tail=100 servicio-pedidos
docker compose logs --tail=100 api-gateway
```

## Probar que responde

El único puerto publicado hacia la computadora es el `3000` del API Gateway.

```powershell
curl.exe http://localhost:3000/healthz
curl.exe http://localhost:3000/api/usuarios/healthz
curl.exe http://localhost:3000/api/productos/healthz
curl.exe http://localhost:3000/api/pedidos/healthz
curl.exe http://localhost:3000/api/usuarios/readyz
curl.exe http://localhost:3000/api/productos/readyz
curl.exe http://localhost:3000/api/pedidos/readyz
```

Las respuestas esperadas son parecidas a `{"status":"ok"}`. Las rutas `readyz` también comprueban la conexión con MongoDB.

## Flujo del Checkpoint 1

Guardar los IDs que devuelve cada respuesta.

### Usuario y login

```powershell
curl.exe -X POST http://localhost:3000/api/usuarios/register `
  -H "Content-Type: application/json" `
  -d '{"nombre":"Ana Lopez","email":"ana@example.com","password":"secreta123"}'

curl.exe -X POST http://localhost:3000/api/usuarios/login `
  -H "Content-Type: application/json" `
  -d '{"email":"ana@example.com","password":"secreta123"}'
```

El registro debe responder `201` con el `id` del usuario y el login debe devolver un token JWT.

### Producto

```powershell
curl.exe -X POST http://localhost:3000/api/productos `
  -H "Content-Type: application/json" `
  -d '{"nombre":"Mouse inalambrico","precio":25.5,"stock":10}'
```

Debe responder `201` con el `id` del producto.

### Pedido

Reemplazar los valores entre `< >` por los IDs reales:

```powershell
curl.exe -X POST http://localhost:3000/api/pedidos `
  -H "Content-Type: application/json" `
  -d '{"usuarioId":"<ID_USUARIO>","items":[{"productoId":"<ID_PRODUCTO>","cantidad":2}]}'

curl.exe http://localhost:3000/api/pedidos/<ID_PEDIDO>
```

El pedido debe responder `201`, quedar como `confirmado` y tener un total de `51`.

### Stock insuficiente

```powershell
curl.exe -X POST http://localhost:3000/api/pedidos `
  -H "Content-Type: application/json" `
  -d '{"usuarioId":"<ID_USUARIO>","items":[{"productoId":"<ID_PRODUCTO>","cantidad":999}]}'
```

La respuesta esperada es `409` y debe indicar que el stock es insuficiente.

## Qué debemos revisar para dar por bueno el Checkpoint 1

- Los tres microservicios se levantan dentro de Docker.
- Cada servicio tiene su propio contenedor y base de datos MongoDB.
- Cada servicio expone `/healthz` y `/readyz`.
- El Gateway responde en el puerto `3000` y enruta las tres rutas públicas.
- El cliente no necesita conocer los puertos internos `3001`, `3002` y `3003`.
- Se puede registrar un usuario, hacer login y crear un producto.
- Las contraseñas usan hash con `bcrypt`, no texto plano.
- Pedidos valida el usuario, consulta el producto y descuenta el stock.
- Un pedido válido queda confirmado y calcula bien el total.
- Un usuario o producto inexistente devuelve error.
- El stock insuficiente devuelve `409` y no confirma el pedido.
- Las llamadas internas usan nombres de Docker, no IPs fijas.
- Las credenciales y secretos vienen de variables de entorno.
- `.env` está ignorado por Git y no hay secretos reales en el repositorio.
- El README permite que otra persona levante el sistema sin preguntarnos cada paso.

## Detener y limpiar

```powershell
docker compose down
```

Para empezar desde cero, incluyendo las bases de datos locales:

```powershell
docker compose down -v
```

El último comando borra los usuarios, productos y pedidos guardados en los volúmenes de MongoDB. Usarlo solamente cuando ya no necesitemos esos datos.
