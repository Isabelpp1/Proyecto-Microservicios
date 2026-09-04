# Checkpoint Final Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

Goal: Convert Checkpoint 2 into a final, reproducible orders platform with strict validation, safe inventory reservation, idempotent orders, consistent errors, stronger security, tests and delivery documentation.

Architecture: Keep Gateway, Usuarios, Productos and Pedidos as independent Node/Express services with one Mongo database per service. Add a protected inventory reservation boundary inside Productos and an idempotent orchestration boundary inside Pedidos; preserve Consul discovery, retry, timeout, circuit breaker and JWT contracts.

Tech Stack: Node.js 20, Express 4, MongoDB 7, Mongoose 8, Docker Compose, Consul 1.17, JWT, bcryptjs, axios, Node built-in test runner, Postman v2.1, GitHub Actions.

Spec: docs/superpowers/specs/2026-09-02-checkpoint-final-design.md

## Global Constraints

- Work on feature/checkpoint-final, based on codex/checkpoint2, without worktrees.
- Do not commit automatically.
- Keep POST /api/pedidos body compatible with { items: [{ productoId, cantidad }] }.
- Keep error in every error response; add code, correlationId and optional details.
- Keep all service-to-service calls on logical Compose names and Consul discovery.
- Keep secrets in environment variables and never add .env to Git.
- Every production behavior change starts with a failing test and ends with the relevant test suite passing.

### Task 1: Test harness and shared validation contracts

Files:
- Modify: servicio-usuarios/package.json, servicio-productos/package.json, servicio-pedidos/package.json, api-gateway/package.json
- Create: servicio-usuarios/test/validation.test.js, servicio-productos/test/validation.test.js, servicio-pedidos/test/validation.test.js
- Create: servicio-usuarios/src/validation.js, servicio-productos/src/validation.js, servicio-pedidos/src/validation.js

Interfaces:
- Each service exports validate... functions returning { valid, value, errors }; no validator throws for user input.
- Pedido validation accepts { items } and returns normalized unique items plus a stable fingerprint input.

- [ ] Write failing tests for empty/unknown fields, invalid IDs, fractional or negative quantities, invalid email, short password, negative price and negative stock.
- [ ] Run each new file with node --test path and confirm failure comes from missing exports or unmet behavior.
- [ ] Implement small pure validators with literal error codes: VALIDATION_ERROR, INVALID_ID, INVALID_EMAIL, INVALID_CREDENTIALS, INVALID_STOCK, INVALID_ITEMS.
- [ ] Add test scripts to all four package manifests; keep existing start/dev scripts.
- [ ] Run all unit tests in each package and confirm green before moving to service routes.

### Task 2: Uniform errors, secure configuration and service bootstraps

Files:
- Create: servicio-usuarios/src/errors.js, servicio-productos/src/errors.js, servicio-pedidos/src/errors.js, api-gateway/src/errors.js
- Create: servicio-usuarios/src/security.js, servicio-productos/src/security.js, servicio-pedidos/src/security.js, api-gateway/src/security.js
- Modify: each service src/index.js, src/observability.js, api-gateway/src/index.js
- Test: add route/middleware tests under the corresponding test directories

Interfaces:
- errorResponse(res, status, code, message, req, details) always emits { error, code, correlationId, details? }.
- securityHeaders sets X-Content-Type-Options, X-Frame-Options, Referrer-Policy and Content-Security-Policy.
- requireInternalServiceToken accepts x-internal-service-token and compares it with INTERNAL_SERVICE_TOKEN.

- [ ] Write failing middleware tests for the error shape, body size rejection, security headers and internal-token rejection.
- [ ] Run the focused tests and verify they fail before implementation.
- [ ] Implement the error/security middleware without adding a new runtime dependency.
- [ ] Add express.json with limit JSON_BODY_LIMIT, security headers and one final JSON parse/error handler to each app.
- [ ] Replace direct console.error responses with structured error events and the uniform response helper.
- [ ] Add startup checks for JWT_SECRET, MONGO_URI, CONSUL_URL and INTERNAL_SERVICE_TOKEN where the service needs them; do not log values.
- [ ] Run syntax checks and all focused tests.

### Task 3: Robust Usuarios authentication and profile contract

Files:
- Modify: servicio-usuarios/src/routes/usuarios.js, servicio-usuarios/src/models/Usuario.js, servicio-usuarios/src/index.js
- Test: servicio-usuarios/test/auth.test.js, servicio-usuarios/test/routes.test.js

Interfaces:
- Register returns 201 with id, nombre, email and never a password field.
- Login signs { sub, userId, email } with configured expiration.
- Invalid register/login data returns 400 with the uniform error envelope; duplicate email remains 409.

- [ ] Write failing tests for normalized email, password minimum, duplicate registration, JWT sub, and hidden password hash.
- [ ] Run tests to verify they fail before implementation.
- [ ] Implement validation and JWT changes while preserving existing route paths and status codes.
- [ ] Add a unique normalized-email index and map duplicate-key errors to 409.
- [ ] Run the Usuarios unit suite and syntax check.

### Task 4: Atomic and protected inventory reservation

Files:
- Create: servicio-productos/src/models/ReservaStock.js, servicio-productos/src/services/inventory.js
- Modify: servicio-productos/src/routes/productos.js, servicio-productos/src/models/Producto.js, servicio-productos/src/index.js
- Create: servicio-productos/test/inventory.test.js, servicio-productos/test/routes.test.js

Interfaces:
- reserveStock({ reservationId, items, productModel, reservationModel }) returns { reservationId, items, status: reserved } or a typed business/dependency error.
- releaseStock({ reservationId, ... }) is idempotent and changes reserved to released exactly once.
- POST /productos/stock/reserve and POST /productos/stock/release require the internal service token.

- [ ] Write failing tests for successful reservation, duplicate reservation, insufficient stock rollback, missing product, release idempotency and internal-token rejection.
- [ ] Run focused tests and confirm the inventory contract fails first.
- [ ] Implement normalized item aggregation, atomic findOneAndUpdate predicates (_id, stock: { $gte: cantidad }), compensation for earlier updates, and reservation state persistence.
- [ ] Keep PATCH /productos/:id/stock as a compatibility endpoint but route it through the same validation and internal-token policy.
- [ ] Make product creation reject non-finite numbers, negative values and invalid strings while retaining its current response shape.
- [ ] Run product unit tests and syntax validation.

### Task 5: Idempotent order orchestration and partial-failure safety

Files:
- Modify: servicio-pedidos/src/models/Pedido.js, servicio-pedidos/src/routes/pedidos.js, servicio-pedidos/src/services/clientesExternos.js
- Create: servicio-pedidos/src/services/idempotency.js, servicio-pedidos/test/orders.test.js, servicio-pedidos/test/idempotency.test.js

Interfaces:
- buildOrderFingerprint(items) returns a deterministic string from normalized items.
- getOrCreateIdempotentOrder({ userId, idempotencyKey, fingerprint }) distinguishes new, existing-same and existing-different requests.
- External client functions include reservarStock(items, reservationId, correlationId) and liberarStock(reservationId, correlationId).

- [ ] Write failing tests for invalid order payloads, duplicate item consolidation, same-key replay, different-payload conflict, dependency failure without mutation and persistence failure compensation.
- [ ] Run the focused order tests and confirm they fail before production changes.
- [ ] Add idempotencyKey and requestFingerprint fields plus a compound unique index on { usuarioId, idempotencyKey }.
- [ ] Create a processing order marker only for keyed requests, validate the user/products before reservation, call one aggregate reservation, then persist the confirmed order.
- [ ] On 4xx business rejection, delete the processing marker without touching stock; on persistence failure, call release and return 503.
- [ ] Preserve 201 for a new successful request, return the stored result for same-key replay, and return 409 IDEMPOTENCY_CONFLICT for a different payload.
- [ ] Ensure dependency errors remain retryable only for transport/5xx cases and retain current circuit breaker behavior.
- [ ] Run the full Pedidos unit suite and syntax validation.

### Task 6: Consul lifecycle, Gateway robustness and observability

Files:
- Modify: servicio-usuarios/src/consul.js, servicio-productos/src/consul.js, servicio-pedidos/src/services/consul.js, all three src/index.js files
- Modify: all src/observability.js files and api-gateway/src/index.js
- Create: servicio-pedidos/test/observability-metrics.test.js if metrics are retained by implementation

Interfaces:
- Registration returns a stoppable retry handle and deregistration is attempted on SIGTERM/SIGINT.
- Gateway returns a uniform JSON 502/503 response when a proxy target is unavailable and always forwards x-correlation-id.
- JSON logs include correlation_id, service, event, level, timestamp and relevant business fields.

- [ ] Write failing tests for deregistration request, proxy error normalization and structured business events.
- [ ] Run focused tests and verify expected failures.
- [ ] Implement stoppable Consul retry registration and graceful shutdown hooks.
- [ ] Add Gateway proxy error handling, request body limit, security headers and a configurable CORS allowlist.
- [ ] Add explicit events for validation rejection, dependency failure, reservation, idempotent replay and order confirmation.
- [ ] Keep /healthz lightweight and /readyz dependent on the service Mongo connection; include service/status fields without breaking status.
- [ ] Run all unit suites and syntax checks.

### Task 7: Compose reproducibility and CI

Files:
- Modify: .env.example, docker-compose.yml, all Dockerfiles, all package manifests
- Create: .github/workflows/ci.yml
- Test: docker compose config, CI commands locally

Interfaces:
- Environment adds INTERNAL_SERVICE_TOKEN, JSON_BODY_LIMIT and optional CORS settings without storing real values.
- Compose passes the internal token only to services that need it and keeps logical service URLs.

- [ ] Write a failing config check or shell assertion for the new required variables before changing Compose.
- [ ] Implement environment wiring, healthchecks/depends-on readiness where supported, and non-secret example values.
- [ ] Update Dockerfiles to use a reproducible install strategy supported by the repository manifests; do not copy .env into images.
- [ ] Add CI steps for npm install, npm test, node --check over every src/test file, and docker compose config with .env.example.
- [ ] Run docker compose config and the same CI commands locally.

### Task 8: Integration and E2E smoke verification

Files:
- Create: test/integration-smoke.js, test/README.md
- Modify: package scripts only if a root runner is introduced

Interfaces:
- The smoke runner accepts BASE_URL (default http://localhost:3000), creates unique test data, and exits nonzero on any failed assertion.
- It verifies health/readiness, registration, login, missing/invalid JWT, valid order, stock-insufficient order, idempotent replay, dependency failure and no unintended mutation.

- [ ] Write the runner assertions before implementation of any missing test helper.
- [ ] Run it against a stopped system to confirm it fails with a clear connection message.
- [ ] Implement only HTTP-level assertions using Node built-in fetch; do not couple E2E tests to another service database.
- [ ] Run after docker compose up --build -d, capture docker compose ps, Consul health API and relevant logs, then stop services.
- [ ] Document the exact command and expected status codes.

### Task 9: Final documentation and Postman collection

Files:
- Modify: README.md
- Create: docs/ARCHITECTURE.md, docs/API.md, docs/MATRIZ_BRECHAS_CHECKPOINT_FINAL.md, docs/GUIA_CHECKPOINT_3.md, docs/GUIA_DEMO_FINAL.md, docs/Checkpoint3.postman_collection.json

Interfaces:
- Docs use the real names Usuarios, Productos and Pedidos and show Gateway-only commands.
- The Postman collection generates unique emails, stores JWT/product/order IDs, tests success and error cases, and never contains secrets.

- [ ] Write the matrix and API contract from the approved spec and current implementation decisions.
- [ ] Add architecture diagram, data ownership table, sequence for order/reservation/compensation and PDF adaptation decisions.
- [ ] Add installation, unit/integration/E2E commands, syntax check, Compose, Consul, health, failure simulation and secret rotation steps.
- [ ] Add a 5-8 minute demo script with visible expected responses and logs.
- [ ] Generate and validate the Postman JSON with a parser; inspect that no JWT, password or internal token is embedded.
- [ ] Run git diff --check, review git diff, and verify every acceptance criterion in the spec.
