# Guía para grabar la demo final

Duración sugerida: 5 a 8 minutos. La demo muestra el dominio real de pedidos y usa el PDF solo como referencia de profundidad.

## Guion

1. (0:00-0:45) Mostrar el repositorio, la rama feature/checkpoint-final y ejecutar docker compose up --build.
2. (0:45-1:15) Abrir Consul en http://localhost:8500 y mostrar los tres servicios passing.
3. (1:15-2:00) Ejecutar healthz/readyz desde Postman o curl y registrar un usuario.
4. (2:00-2:30) Hacer login y mostrar que se obtiene un JWT sin exponer secretos.
5. (2:30-3:15) Crear un producto con stock 3 y crear un pedido válido de cantidad 2 usando Authorization y Idempotency-Key.
6. (3:15-3:45) Repetir exactamente el pedido: mostrar 200, mismo pedido y stock todavía en 1.
7. (3:45-4:30) Enviar cantidad 99: mostrar 409 STOCK_INSUFFICIENT, verificar que el pedido no aumentó y que stock sigue en 1.
8. (4:30-5:00) Enviar el pedido sin JWT y con payload inválido: mostrar 401 y 400.
9. (5:00-6:15) Ejecutar docker compose stop servicio-productos, enviar un pedido con el smoke degradado o Postman, mostrar 503 y que no se crea pedido.
10. (6:15-7:00) Mostrar logs JSON filtrados por correlation_id con retries/circuit_open y volver a ejecutar docker compose start servicio-productos.
11. (7:00-8:00) Mostrar README, arquitectura, contratos API, matriz de brechas, CI y la colección Postman final.

## Evidencia que conviene dejar visible

- Respuesta x-correlation-id del Gateway.
- Mismo correlation_id en logs de Pedidos y las dependencias.
- estado: confirmado y total del pedido.
- Replay con status 200 y sin descuento adicional.
- 409 de stock insuficiente, sin nuevo pedido.
- 401 sin JWT.
- 503 con Productos detenido, sin nuevo pedido.
- Servicios verdes en Consul.

## Preparación

Importa docs/Checkpoint3.postman_collection.json. Ejecuta primero la carpeta Salud y luego Flujo principal. La colección genera un email único y guarda token, producto y pedido automáticamente.
