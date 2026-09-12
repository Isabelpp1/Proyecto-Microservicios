# Matriz de brechas: Checkpoint 2, PDF y entrega final

## Lectura de alcance

El PDF describe FitFlow y cinco tareas académicas. Sus nombres de dominio son ejemplos. RFC-001 define nuestro dominio como Usuarios, Productos y Pedidos, Node.js/Express, MongoDB, Gateway y Compose. La columna final aplica el nivel de madurez transferible sin mezclar bounded contexts.

Para la revisión requisito por requisito del PDF, consultar [MATRIZ_CUMPLIMIENTO_PDF.md](MATRIZ_CUMPLIMIENTO_PDF.md). Esta matriz resume las brechas funcionales entre checkpoints.

| Área | Ya existía en CP1/CP2 | Referencia del PDF | Incorporado en CP3 final | Estado |
|---|---|---|---|---|
| Servicios independientes | Usuarios, Productos y Pedidos | Task 1: servicios separados | Se conservan y se validan con Compose | Implementado |
| Database per Service | Tres Mongo separados | Task 1: BD propia por servicio | Se conserva; ningún acceso cruzado | Implementado |
| Gateway | Proxy en puerto 3000 | Entrega con entrada operativa | UI estática para demo, correlation ID, body limit, headers y errores upstream | Implementado |
| Consul | Registro y discovery para Pedidos | Task 2A | Health checks, discovery y deregistro limpio | Implementado |
| JWT | Protege POST de pedidos | Task 4A | Claims sub/userId/email y configuración validada | Implementado |
| Secretos | .env ignorado | Task 4B | Token interno, ejemplos no sensibles y rotación documentada | Implementado |
| Validación | Requeridos mínimos | Nivel final esperado | Tipos, rangos, IDs, campos desconocidos, JSON y límites | Implementado |
| Errores | Respuestas ad hoc | Calidad de entrega | Envelope uniforme con code/correlationId/details | Implementado |
| Stock | GET + PATCH secuencial | Analogía de consistencia | Reserva agregada, predicados atómicos, rollback y release | Implementado |
| Fallos parciales | Best effort documentado | Task 3A: supervivencia ante dependencia | No confirma pedidos con dependencias caídas; compensa reservas tras fallo de persistencia | Implementado |
| Idempotencia | Ausente | Profundidad de entrega final | Idempotency-Key y huella de payload | Implementado |
| Retry | 3 reintentos existentes | Task 3A | Mantiene backoff/jitter y no reintenta errores de negocio | Implementado |
| Circuit breaker | Existente para Usuarios/Productos | Task 3A | Handle por dependencia y logs de circuito | Implementado |
| Logs | JSON y correlation ID | Task 3B | Eventos de negocio, sanitización de correlation ID y logs de DB | Implementado |
| Health/readiness | Existentes | Task 1/2 | Respuestas con servicio y Compose healthchecks | Implementado |
| Pruebas unitarias | Solo Pedidos | Entrega verificable | Unitarias en los cuatro componentes y E2E HTTP | Implementado |
| Integración | Manual | Entrega verificable | Smoke reproducible contra Gateway + Consul | Implementado |
| Documentación | README y guías CP1/CP2 | Task 4C | Arquitectura, API, matriz, guía y demo | Implementado |
| Postman | Colecciones CP1/CP2 | Demo final | Colección automatizada CP3 sin secretos | Implementado |
| CI/CD | No existía | Práctica razonable de entrega | GitHub Actions para install, tests, sintaxis y Compose config | Implementado |
| Notificaciones | No existe en RFC | Task 3 usa notif-svc | No se agrega servicio artificial; dependencias críticas son Usuarios/Productos | Deliberadamente fuera |
| MCP | No existe en RFC | Task 2B | Se documenta extensión posible detrás del Gateway | Deliberadamente fuera |
| A2A | No existe en RFC | Task 5 | Se documenta fuera por ausencia de bounded context de agentes | Deliberadamente fuera |
| Cloud | No requerido | Extra del PDF | Se conserva Compose local reproducible | Fuera de alcance |

## Decisiones no literales

El PDF resuelve la caída de notif-svc dejando una notificación pendiente. En pedidos, aceptar sin validar usuario o sin reservar inventario produciría datos inválidos, por lo que la adaptación correcta es responder 503 y mantener el estado sin mutaciones. La compensación de inventario cubre el fallo entre reserva y persistencia.
