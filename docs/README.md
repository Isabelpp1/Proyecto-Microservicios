# Documentación del proyecto

Este directorio concentra la documentación de la evolución del sistema de gestión de pedidos.
La fuente principal del dominio es [RFC-001](RFC-001.md). El PDF de FitFlow se usa únicamente como
referencia de profundidad académica; sus clases, reservas fitness, notificaciones, MCP y A2A no se
incorporan al dominio de Usuarios, Productos y Pedidos.

## Lectura recomendada

1. [CHECKPOINT_1.md](CHECKPOINT_1.md): alcance y capacidades de la primera entrega.
2. [CHECKPOINT_2.md](CHECKPOINT_2.md): mejoras de seguridad, discovery, resiliencia y observabilidad.
3. [CHECKPOINT_FINAL.md](CHECKPOINT_FINAL.md): cambios finales respecto al Checkpoint 2.
4. [ARCHITECTURE.md](ARCHITECTURE.md): componentes, ownership de datos y flujos internos.
5. [API.md](API.md): contratos, estados y errores.
6. [MATRIZ_CUMPLIMIENTO_PDF.md](MATRIZ_CUMPLIMIENTO_PDF.md): revisión requisito por requisito contra el PDF.
7. [GUIA_DEMO_FINAL.md](GUIA_DEMO_FINAL.md): guion para la demostración.

## Requisitos

- Docker Desktop iniciado.
- Git y PowerShell.
- Node.js 20 o superior para pruebas locales.
- Puertos 3000 y 8500 libres.

No es necesario instalar MongoDB ni las dependencias de Node para ejecutar la aplicación con Docker.

## Instalación inicial

```powershell
git clone <URL_DEL_REPOSITORIO>
Set-Location Proyecto-Microservicios
Copy-Item .env.example .env
```

Completa `.env` con valores locales. Nunca publiques ese archivo, lo agregues a Git ni pegues sus
valores en capturas, Postman o logs.

Verifica que el archivo está ignorado:

```powershell
git check-ignore .env
```

## Levantar el sistema

Validar Compose antes de iniciar:

```powershell
docker compose config
```

Modo visible, recomendado para la demo:

```powershell
docker compose up --build
```

Modo segundo plano:

```powershell
docker compose up --build -d
docker compose ps
```

Abrir la interfaz visual en [http://localhost:3000](http://localhost:3000). Consul queda disponible
en [http://localhost:8500](http://localhost:8500).

## Pruebas locales

Ejecutar cada servicio desde su propio directorio:

```powershell
Set-Location servicio-usuarios
npm test
Set-Location ..\servicio-productos
npm test
Set-Location ..\servicio-pedidos
npm test
Set-Location ..\api-gateway
npm test
Set-Location ..
```

Validar sintaxis de todo el JavaScript, incluyendo la UI:

```powershell
$paths = @(
  'servicio-usuarios/src', 'servicio-usuarios/test',
  'servicio-productos/src', 'servicio-productos/test',
  'servicio-pedidos/src', 'servicio-pedidos/test',
  'api-gateway/src', 'api-gateway/test', 'api-gateway/public', 'test'
)
Get-ChildItem -Recurse -File -Path $paths -Filter '*.js' | ForEach-Object {
  node --check $_.FullName
}
docker compose config
```

Con Compose arriba, ejecutar el smoke HTTP contra el Gateway:

```powershell
node test/integration-smoke.js
```

El smoke verifica health/readiness, Consul, registro, login, JWT, pedido válido, replay idempotente,
stock insuficiente, payload inválido y que los rechazos no muten pedidos ni stock.

## Flujo visual básico

1. Abrir `http://localhost:3000` y comprobar las tarjetas de estado.
2. Registrar un usuario y pulsar **Obtener JWT**.
3. Agregar un producto al carrito y crear el pedido.
4. Pulsar **Repetir última solicitud** para mostrar el replay idempotente.
5. Cerrar sesión e intentar crear un pedido para mostrar el `401`.
6. Usar una cantidad mayor al stock para mostrar el `409` sin cambios de inventario.

La UI consume únicamente rutas del Gateway; Postman sigue disponible para revisar los contratos HTTP
en [Checkpoint3.postman_collection.json](Checkpoint3.postman_collection.json).

## Consul, logs y dependencia caída

```powershell
docker compose ps
docker compose logs --no-color servicio-pedidos | Select-String 'correlation_id|dependency_retry|circuit_open|order_confirmed'
```

Para probar la degradación de Productos desde la interfaz, deja un producto en el carrito y ejecuta:

```powershell
docker compose stop servicio-productos
```

El intento de pedido debe devolver `503`, sin crear un pedido. Recuperar el servicio con:

```powershell
docker compose start servicio-productos
```

Esperar a que `docker compose ps` lo muestre como `healthy` y pulsar **Actualizar estado**.

## Secretos y rotación

Los valores de `.env.example` son solo ejemplos locales. Antes de compartir la entrega, genera valores
nuevos para `JWT_SECRET`, `INTERNAL_SERVICE_TOKEN` y las credenciales de Mongo.

Para rotar JWT y el token interno en una demo local:

```powershell
# Editar .env con valores nuevos sin mostrarlos en pantalla
docker compose up -d --force-recreate servicio-usuarios servicio-productos servicio-pedidos
```

Los JWT anteriores dejarán de validar y las llamadas internas con el token anterior serán rechazadas.
Para cambiar credenciales de Mongo con volúmenes persistentes se requiere una migración de usuarios de
Mongo; para reiniciar una demo desde cero puede usarse, con cuidado:

```powershell
docker compose down -v
docker compose up --build
```

El último comando borra las tres bases locales.

## Detener

```powershell
docker compose down
```

## CI

GitHub Actions ejecuta los tests de cada servicio, valida sintaxis de `src`, `test` y `public` cuando
existe, y ejecuta `docker compose config` usando `.env.example`. La matriz está configurada con
`fail-fast: false` para que un fallo de un servicio no oculte el resultado de los demás.

