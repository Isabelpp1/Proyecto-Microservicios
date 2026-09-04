# Guía de Checkpoint 3 final

## Requisitos

- Docker Desktop iniciado.
- Git, PowerShell y Node.js 20 o superior para ejecutar el smoke local.
- Puerto 3000 libre para Gateway y 8500 libre para Consul.

## Preparación

```
powershell
git clone <URL_DEL_REPOSITORIO>
cd Proyecto-Microservicios
Copy-Item .env.example .env
docker compose config
```

Usa un JWT_SECRET y un INTERNAL_SERVICE_TOKEN largos y aleatorios fuera de una demo local. No subas .env.

## Levantar

```
powershell
docker compose up --build
```

En otra terminal, para modo detached:

```
powershell
docker compose up --build -d
docker compose ps
```

## Pruebas unitarias

```
powershell
node --test servicio-usuarios/test/*.test.js
node --test servicio-productos/test/*.test.js
node --test servicio-pedidos/test/*.test.js
node --test api-gateway/test/*.test.js
```

## Sintaxis y Compose

```
powershell
Get-ChildItem -Recurse -File -Path servicio-usuarios/src,servicio-usuarios/test,servicio-productos/src,servicio-productos/test,servicio-pedidos/src,servicio-pedidos/test,api-gateway/src,api-gateway/test,test | ForEach-Object { node --check $_.FullName }
docker compose config
```

## Smoke E2E

```
powershell
node test/integration-smoke.js
```

El smoke registra un usuario único, comprueba login incorrecto y correcto, JWT requerido, crea producto, crea pedido, repite la clave de idempotencia, confirma stock, prueba stock insuficiente, payload inválido y consulta Consul.

## Caída de Productos

Primero ejecuta el smoke normal y guarda los valores de salida o usa los IDs/token de Postman. Luego:

```
powershell
docker compose stop servicio-productos
$env:EXPECT_PRODUCTOS_DOWN = "true"
$env:E2E_TOKEN = "<JWT_VALIDO>"
$env:E2E_USER_ID = "<ID_USUARIO>"
$env:E2E_PRODUCT_ID = "<ID_PRODUCTO>"
node test/integration-smoke.js
Remove-Item Env:EXPECT_PRODUCTOS_DOWN
Remove-Item Env:E2E_TOKEN
Remove-Item Env:E2E_USER_ID
Remove-Item Env:E2E_PRODUCT_ID
docker compose start servicio-productos
```

El smoke degradado espera 503 y comprueba que el número de pedidos no cambia. Los logs muestran retries, discovery sin instancia o circuit_open según el momento.

## Consul y logs

Abrir http://localhost:8500 y verificar servicio-usuarios, servicio-productos y servicio-pedidos en estado passing.

```
powershell
docker compose logs --no-color servicio-pedidos | Select-String "correlation_id|dependency_retry|circuit_open|order_confirmed"
```

## Rotación de secretos

1. Genera un JWT_SECRET nuevo y un INTERNAL_SERVICE_TOKEN nuevo fuera del repositorio.
2. Actualiza ambos valores en .env.
3. Recrea Usuarios, Pedidos y Productos:

```
powershell
docker compose up -d --force-recreate servicio-usuarios servicio-pedidos servicio-productos
```

4. Los JWT antiguos dejan de funcionar al cambiar JWT_SECRET; se debe iniciar sesión de nuevo.
5. El token interno anterior deja de permitir reservas.
6. Nunca pegues valores reales en README, Postman o logs.

## Detener

```
powershell
docker compose down
```

Usa docker compose down -v únicamente si quieres borrar las tres bases de datos locales.
