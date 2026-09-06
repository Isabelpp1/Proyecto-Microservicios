require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');
const { correlationMiddleware } = require('./observability');
const { errorResponse, errorHandler } = require('./errors');
const { securityHeaders, assertRequiredEnvironment } = require('./security');

const app = express();
const PORT = process.env.PORT || 3000;
const corsOrigin = process.env.CORS_ORIGIN || '*';

app.use(cors({ origin: corsOrigin }));
app.use(securityHeaders);
app.use(correlationMiddleware('api-gateway'));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '100kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

function proxyOptions(target, pathRewrite) {
  return {
    target,
    changeOrigin: true,
    pathRewrite,
    onProxyReq: (proxyReq, req) => {
      proxyReq.setHeader('x-correlation-id', req.correlationId);
      fixRequestBody(proxyReq, req);
    },
    onError: (error, req, res) => {
      if (res.headersSent) return;
      return errorResponse(
        res,
        503,
        'UPSTREAM_UNAVAILABLE',
        'Servicio temporalmente no disponible',
        req,
        { error: error.code || error.message }
      );
    }
  };
}

// Punto de entrada unico: el cliente solo conoce al Gateway, nunca a los
// servicios internos directamente. El Gateway enruta segun el path.

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

// Los endpoints de salud viven en la raiz de cada microservicio. Se declaran
// antes de los proxies generales para evitar que, por ejemplo, "healthz" sea
// interpretado como un ID en /usuarios/:id.
function proxyHealthEndpoints(publicPath, target) {
  for (const endpoint of ['healthz', 'readyz']) {
    app.use(
      `${publicPath}/${endpoint}`,
      createProxyMiddleware(proxyOptions(
        target,
        { [`^${publicPath}/${endpoint}`]: `/${endpoint}` }
      ))
    );
  }
}

proxyHealthEndpoints('/api/usuarios', process.env.USUARIOS_SERVICE_URL);
proxyHealthEndpoints('/api/productos', process.env.PRODUCTOS_SERVICE_URL);
proxyHealthEndpoints('/api/pedidos', process.env.PEDIDOS_SERVICE_URL);

app.use(
  '/api/usuarios',
  createProxyMiddleware(proxyOptions(
    process.env.USUARIOS_SERVICE_URL,
    { '^/api/usuarios': '/usuarios' }
  ))
);

app.use(
  '/api/productos',
  createProxyMiddleware(proxyOptions(
    process.env.PRODUCTOS_SERVICE_URL,
    { '^/api/productos': '/productos' }
  ))
);

app.use(
  '/api/pedidos',
  createProxyMiddleware(proxyOptions(
    process.env.PEDIDOS_SERVICE_URL,
    { '^/api/pedidos': '/pedidos' }
  ))
);

app.use((req, res) => {
  errorResponse(res, 404, 'ROUTE_NOT_FOUND', 'Ruta no reconocida por el API Gateway', req);
});

app.use(errorHandler);

assertRequiredEnvironment([
  'USUARIOS_SERVICE_URL',
  'PRODUCTOS_SERVICE_URL',
  'PEDIDOS_SERVICE_URL'
]);

app.listen(PORT, () => {
  console.log(JSON.stringify({
    correlation_id: 'system',
    service: 'api-gateway',
    event: 'server_started',
    level: 'info',
    timestamp: new Date().toISOString(),
    port: Number(PORT)
  }));
});
