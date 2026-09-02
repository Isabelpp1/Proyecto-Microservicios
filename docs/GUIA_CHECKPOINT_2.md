# Guía de demostración — Checkpoint 2

## Preparación

1. Copiar `.env.example` como `.env` y completar los secretos locales.
2. Ejecutar `docker compose up --build`.
3. Abrir Consul en `http://localhost:8500` y mostrar los tres servicios saludables.
4. Importar `docs/Checkpoint2.postman_collection.json` en Postman. La colección guarda
   automáticamente el token, el ID del producto y el ID de correlación como variables de colección.

## Flujo sugerido (5–7 minutos)

1. Mostrar la arquitectura: Gateway como acceso público, tres bases independientes y Consul para
   descubrimiento. Aclarar que Pedidos no lee las bases de Usuarios ni Productos.
2. En Consul, abrir **Services** y enseñar `servicio-usuarios`, `servicio-productos` y
   `servicio-pedidos` con sus health checks.
3. Ejecutar en Postman, en este orden: **Registrar usuario**, **Login** y **Crear producto**.
4. Ejecutar **Pedido sin JWT** y **Pedido con JWT inválido**: ambos responden `401`.
5. Ejecutar **Pedido válido con correlación**. Mostrar que el body sólo contiene `items`; la
   respuesta contiene el `usuarioId` extraído del JWT.
6. Abrir una terminal y buscar el mismo ID:

   ```powershell
   docker compose logs --no-color | Select-String '<correlation_id>'
   ```

   Deben aparecer eventos JSON de Gateway, Pedidos, Usuarios y Productos.
7. Ejecutar **Pedido con stock insuficiente** y mostrar el `409` controlado.

## Resiliencia y recuperación

Antes de iniciar, conservar el token y el ID de producto creados por la colección.

```powershell
docker compose stop servicio-productos
```

Enviar tres veces **Pedido válido con correlación**. Cada llamada obtiene `503` y registra eventos
de reintento con `attempt`, `target_service` y estado del circuito. El tercer fallo abre el circuito.
Un cuarto envío obtiene `503` de inmediato, sin volver a llamar al servicio caído.

```powershell
docker compose logs --no-color servicio-pedidos | Select-String 'retry|circuit|dependency'
docker compose start servicio-productos
```

Esperar aproximadamente 30 segundos, confirmar en Consul que Productos está saludable y enviar un
pedido nuevo. La prueba half-open debe tener éxito y el circuito vuelve a cerrarse.

## Criterios visibles

- JWT ausente o inválido: `401`.
- Pedido válido: `201`, usuario tomado del token y stock descontado.
- Stock insuficiente: `409`.
- Dependencia caída o circuito abierto: `503`, sin crear pedido pendiente.
- Un mismo `x-correlation-id` aparece en todos los logs relacionados.
