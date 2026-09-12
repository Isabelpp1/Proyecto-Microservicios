# Smoke de integración y E2E

El smoke test usa únicamente HTTP contra el API Gateway. No consulta las bases de datos de otros servicios.

```
powershell
node test/integration-smoke.js
```

Para validar una dependencia caída, detener Productos en otra terminal, ejecutar el smoke con el caso opcional y luego iniciar el servicio:

```
powershell
docker compose stop servicio-productos
$env:EXPECT_PRODUCTOS_DOWN = "true"
node test/integration-smoke.js
Remove-Item Env:EXPECT_PRODUCTOS_DOWN
docker compose start servicio-productos
```

El caso opcional espera 503, conserva el número de pedidos y no permite un descuento adicional de stock.
