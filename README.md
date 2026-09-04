# Sistema de gestión de pedidos para una tienda en línea

Entrega final del proyecto de Arquitectura de Componentes y Microservicios. El dominio real es el
definido en [RFC-001](docs/RFC-001.md): Usuarios, Productos y Pedidos. El PDF de FitFlow se usó
únicamente como referencia de nivel y alcance; no se incorporaron sus bounded contexts.

## Arquitectura

~~~text
Cliente / Postman / curl
            |
            v
    API Gateway :3000
       /       |       \
      v        v        v
 Usuarios  Productos  Pedidos
  :3001      :3002     :3003
      |        |        |
      v        v        v
 mongo-     mongo-    mongo-
usuarios  productos  pedidos

 Consul :8500 registra y verifica los tres servicios.
 Pedidos descubre Usuarios y Productos mediante Consul.
~~~

- El Gateway es el único punto de entrada publicado al host.
- Cada servicio posee su propia base de datos MongoDB; no hay consultas cruzadas entre bases.
- Pedidos valida el usuario, consulta el catálogo, reserva inventario y confirma el pedido mediante
  llamadas HTTP a servicios descubiertos dinámicamente.
- La comunicación interna usa nombres lógicos de Docker (servicio-usuarios, servicio-productos,
  servicio-pedidos), no direcciones IP fijas.

## Funcionalidades de la entrega final

- Registro y login con bcrypt y JWT (sub, userId, email, expiración configurable).
- Validación estricta de tipos, rangos, ObjectId, campos desconocidos y tamaño de JSON.
- Envelope de errores consistente con error, code, correlationId y details opcional.
- Headers de seguridad, CORS configurable y token interno para operaciones de inventario.
- Reserva de stock agregada, actualización atómica, rollback ante fallo parcial y liberación
  idempotente.
- Idempotency-Key opcional en creación de pedidos: replay exacto devuelve 200 y el mismo pedido;
  una huella diferente devuelve 409.
- Consul con registro, discovery de instancias saludables y deregistro al apagar el servicio.
- Timeout de 2 segundos, hasta 3 reintentos con backoff/jitter y circuit breaker por dependencia.
- Logs JSON con correlation_id, eventos de negocio y propagación de x-correlation-id.
- /healthz, /readyz, healthchecks de Compose, pruebas unitarias, smoke E2E y CI.

La matriz de brechas y las decisiones de adaptación están en
[docs/MATRIZ_BRECHAS_CHECKPOINT_FINAL.md](docs/MATRIZ_BRECHAS_CHECKPOINT_FINAL.md).

## Estructura

~~~text
api-gateway/                         # Proxy HTTP y punto de entrada :3000
servicio-usuarios/                   # Registro, login y perfil
servicio-productos/                  # Catálogo, stock y reservas
servicio-pedidos/                    # Orquestación, idempotencia y pedidos
test/integration-smoke.js             # Smoke E2E contra el Gateway
test/compose-config.test.js           # Contrato mínimo de Compose
docs/ARCHITECTURE.md                 # Decisiones y flujos
docs/API.md                           # Contratos de API
docs/GUIA_CHECKPOINT_3.md            # Instalación, pruebas y fallos
docs/GUIA_DEMO_FINAL.md              # Guion para el video
docs/Checkpoint3.postman_collection.json
.github/workflows/ci.yml             # Tests, sintaxis y Compose config
docker-compose.yml
.env.example
~~~

## Requisitos e instalación

Se necesita Docker Desktop iniciado, Git y Node.js 20 o superior. Node solo es necesario para
ejecutar las pruebas locales; Compose instala las dependencias dentro de las imágenes.

PowerShell:

~~~powershell
git clone <URL_DEL_REPOSITORIO>
Set-Location Proyecto-Microservicios
Copy-Item .env.example .env
~~~

Antes de compartir el proyecto, cambia JWT_SECRET, INTERNAL_SERVICE_TOKEN y las contraseñas de
Mongo en .env por valores largos y aleatorios. .env está ignorado por Git; nunca lo agregues ni
pegues sus valores en Postman, README, tickets o logs.

## Levantar el sistema

Validar la configuración y construir todos los servicios:

~~~powershell
docker compose config
docker compose up --build
~~~

Para ejecutarlo en segundo plano:

~~~powershell
docker compose up --build -d
docker compose ps
~~~

Puertos publicados: Gateway 3000 y Consul 8500. MongoDB y los microservicios quedan dentro de
la red de Compose. Detener sin eliminar datos:

~~~powershell
docker compose down
~~~

docker compose down -v elimina las tres bases locales y debe usarse solo cuando se quiera reiniciar
los datos de la demo.

## Pruebas

Con las dependencias de Node instaladas en cada servicio, ejecutar todas las pruebas unitarias:

~~~powershell
node --test servicio-usuarios/test/*.test.js
node --test servicio-productos/test/*.test.js
node --test servicio-pedidos/test/*.test.js
node --test api-gateway/test/*.test.js
~~~

Validar sintaxis de todo el código JavaScript y Compose:

~~~powershell
Get-ChildItem -Recurse -File -Path servicio-usuarios/src,servicio-usuarios/test,servicio-productos/src,servicio-productos/test,servicio-pedidos/src,servicio-pedidos/test,api-gateway/src,api-gateway/test,test | ForEach-Object { node --check $_.FullName }
docker compose config
~~~

Con Compose arriba, ejecutar el smoke de integración:

~~~powershell
node test/integration-smoke.js
~~~

El smoke comprueba salud/readiness, Consul, registro, login correcto e incorrecto, JWT obligatorio,
creación de producto, pedido válido, replay idempotente, stock insuficiente, payload inválido y que
los rechazos no aumenten la cantidad de pedidos ni descuenten stock.

## Flujo rápido de API

1. Registrar usuario en POST /api/usuarios/register.
2. Iniciar sesión en POST /api/usuarios/login y guardar token.
3. Crear producto en POST /api/productos.
4. Crear pedido en POST /api/pedidos con Authorization: Bearer <token> e
   Idempotency-Key: demo-001.
5. Repetir exactamente la solicitud: debe devolver 200 con el mismo _id y sin descontar stock.

Ejemplo de pedido:

~~~json
{
  "items": [
    { "productoId": "507f1f77bcf86cd799439011", "cantidad": 2 }
  ]
}
~~~

Contratos completos, estados y códigos están en [docs/API.md](docs/API.md). La colección final para
Postman está en [docs/Checkpoint3.postman_collection.json](docs/Checkpoint3.postman_collection.json).

## Salud, Consul y resiliencia

~~~powershell
Invoke-RestMethod http://localhost:3000/healthz
Invoke-RestMethod http://localhost:3000/api/usuarios/readyz
Invoke-RestMethod http://localhost:3000/api/productos/readyz
Invoke-RestMethod http://localhost:3000/api/pedidos/readyz
Invoke-RestMethod 'http://localhost:8500/v1/health/service/servicio-pedidos?passing=true'
docker compose logs --no-color servicio-pedidos | Select-String 'correlation_id|dependency_retry|circuit_open|order_confirmed'
~~~

Para demostrar una dependencia caída, primero crea un JWT, usuario y producto válidos; luego detén
Productos y ejecuta el smoke degradado:

~~~powershell
docker compose stop servicio-productos
$env:EXPECT_PRODUCTOS_DOWN = 'true'
$env:E2E_TOKEN = '<JWT_VALIDO>'
$env:E2E_USER_ID = '<ID_USUARIO>'
$env:E2E_PRODUCT_ID = '<ID_PRODUCTO>'
node test/integration-smoke.js
Remove-Item Env:EXPECT_PRODUCTOS_DOWN,Env:E2E_TOKEN,Env:E2E_USER_ID,Env:E2E_PRODUCT_ID
docker compose start servicio-productos
~~~

La solicitud debe responder 503, no crear un pedido y no cambiar el conteo existente. La guía
operativa está en [docs/GUIA_CHECKPOINT_3.md](docs/GUIA_CHECKPOINT_3.md).

## Seguridad y rotación de secretos

- Passwords se almacenan con bcrypt; nunca se devuelve passwordHash.
- JWT_SECRET, INTERNAL_SERVICE_TOKEN y credenciales de Mongo solo llegan por .env.
- Para rotar secretos, genera valores nuevos fuera del repositorio, actualiza .env y recrea los
  servicios:

~~~powershell
docker compose up -d --force-recreate servicio-usuarios servicio-pedidos servicio-productos
~~~

Los JWT firmados con el secreto anterior dejan de ser válidos. El token interno anterior tampoco
permite reservas. Después de rotar, inicia sesión de nuevo y verifica /readyz.

## CI y documentación

GitHub Actions instala las dependencias, ejecuta tests y validación de sintaxis por servicio, y
ejecuta docker compose config con .env.example. La documentación de arquitectura, contratos,
matriz y demo se encuentra en docs/.

## Alcance deliberadamente fuera

No se agregaron roles administrativos, pagos, notificaciones, RabbitMQ, MCP, agentes A2A ni despliegue
cloud: RFC-001 no los define y agregarlos habría mezclado bounded contexts del PDF con el sistema de
pedidos. Se deja documentada la extensión posible sin inventar funcionalidades de negocio.

## Equipo

Carlos Daniel Martinez, Douglas Pérez e Isabel Paiz.
