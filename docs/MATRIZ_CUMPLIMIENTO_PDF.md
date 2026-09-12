# Matriz de cumplimiento frente al PDF de referencia

## Cómo se interpreta el PDF

El PDF describe un proyecto distinto, FitFlow, con clases fitness, reservas, notificaciones, MCP y
agentes A2A. Este repositorio implementa el dominio de pedidos de RFC-001. Por lo tanto, la revisión
separa:

1. requisitos técnicos transferibles que sí se deben cumplir;
2. funcionalidades específicas de FitFlow que no se deben inventar en este dominio;
3. puntos extra opcionales que no son necesarios para la entrega del curso.

## Matriz detallada

| Referencia del PDF | Expectativa original | Evidencia en este proyecto | Estado |
|---|---|---|---|
| Task 1 | Tres servicios independientes. | Usuarios, Productos y Pedidos con procesos y Dockerfiles propios. | Cumple |
| Task 1 | Docker Compose levanta el sistema. | `docker-compose.yml`, health checks y `docker compose config`. | Cumple |
| Task 1 | Database per Service. | Tres Mongo separados: usuarios, productos y pedidos. | Cumple adaptado |
| Task 1 | PostgreSQL por servicio. | RFC-001 selecciona MongoDB/Mongoose; aislamiento de datos sí se conserva. | Adaptación justificada |
| Task 1 | `/healthz` y `/readyz`. | Cada microservicio expone ambos; el Gateway expone `/healthz` y proxifica el readiness de cada servicio. | Cumple |
| Task 1 | Secretos mediante `.env` ignorado. | `.env.example`, `.gitignore`, variables de entorno y guía de rotación. | Cumple |
| Task 1 | Comunicación por nombres lógicos. | Nombres Docker y discovery Consul; no se usan IPs fijas. | Cumple |
| Task 1 | APIs de usuarios, operación principal y salud. | Registro, login, perfil, catálogo, pedidos y health/readiness. | Cumple adaptado |
| Task 2A | Auto-registro en Consul. | Los tres servicios se registran al arrancar, con dirección, puerto y check. | Cumple |
| Task 2A | Discovery de instancias saludables. | Pedidos consulta Consul con `passing=true` antes de llamar dependencias. | Cumple |
| Task 2A | Deregistro después de fallo. | Check con intervalo de 10s y `DeregisterCriticalServiceAfter: 30s`; apagado solicita deregistro. | Cumple |
| Task 2B | MCP Server con tres herramientas FitFlow. | RFC-001 no define agentes ni herramientas MCP. | Fuera de dominio |
| Task 3A | Timeout. | Timeout HTTP configurable de 2 segundos en llamadas de Pedidos. | Cumple |
| Task 3A | Retries con backoff y jitter. | Hasta tres reintentos para transporte, timeout, 408, 429 y 5xx. | Cumple |
| Task 3A | Circuit breaker. | Tres fallos abren el circuito por 30s y existe recuperación half-open. | Cumple |
| Task 3A | Notificación pendiente/outbox. | No existe `notif-svc`; Usuarios y Productos son dependencias críticas para aceptar pedidos. | Adaptación justificada |
| Task 3B | Logs JSON estructurados. | Logs con `correlation_id`, `service`, `event`, `level` y `timestamp`. | Cumple |
| Task 3B | Correlation ID entre servicios. | `x-correlation-id` se genera, devuelve y propaga en llamadas internas. | Cumple |
| Task 4A | JWT en endpoints protegidos. | Usuarios firma JWT; Pedidos valida Bearer; Productos protege endpoints internos con token de servicio. | Cumple adaptado |
| Task 4A | `user_id` en logs. | La identidad del pedido se toma de los claims y los eventos de negocio registran el usuario cuando aplica. | Cumple adaptado |
| Task 4B | Secretos fuera del código. | JWT, token interno y Mongo URI llegan desde `.env`; no se rastrea `.env`. | Cumple |
| Task 4B | Rotación documentada. | `docs/README.md` y `GUIA_CHECKPOINT_3.md` documentan rotación y efectos sobre JWT/token interno. | Cumple |
| Task 4C | README de arquitectura y ejecución. | README raíz, `docs/README.md`, arquitectura, API y guías. | Cumple |
| Task 4C | Video demo. | Guion visual con flujo feliz, replay, JWT, stock, dependencia caída y logs. | Listo para demo |
| Task 5 | Agentes A2A, Agent Cards y Orchestrator. | No hay agentes en RFC-001 y el curso evalúa tres checkpoints de pedidos. | Fuera de dominio |
| Extra | Despliegue cloud. | No requerido; Compose local queda reproducible. | Fuera de alcance |

## Criterios de evaluación transferibles

| Criterio del PDF | Evaluación para este repositorio |
|---|---|
| Servicios + Compose + BD propia | Cumplido con Mongo por decisión del RFC. |
| Consul + discovery dinámico | Cumplido y probado con los tres servicios en `passing`. |
| Circuit breaker demostrado | Cumplido para Usuarios/Productos, con `503` seguro y sin mutaciones parciales. |
| JWT + secretos | Cumplido con JWT, token interno y `.env`. |
| README + demo | Cumplido con documentación ampliada y UI visual. |
| MCP literal de FitFlow | No aplicable al dominio real; queda explícitamente fuera. |
| A2A literal de FitFlow | No aplicable al dominio real; queda explícitamente fuera. |

No es correcto afirmar que el proyecto cumple literalmente el puntaje total del PDF porque MCP, A2A,
notificaciones y cloud no fueron implementados. Sí cumple la profundidad técnica pertinente al alcance
real de tres checkpoints y documenta cada exclusión para no mezclar dominios.

## Evidencia de verificación

```powershell
docker compose config
docker compose up --build -d
docker compose ps
node test/integration-smoke.js
```

Además, la entrega cuenta con tests unitarios por servicio, prueba E2E HTTP, contrato de Compose,
validación de sintaxis y una prueba controlada con `docker compose stop servicio-productos` que verifica
`503` sin crear pedidos.
