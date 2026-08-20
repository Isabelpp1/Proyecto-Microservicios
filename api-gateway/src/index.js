require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

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
      createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: { [`^${publicPath}/${endpoint}`]: `/${endpoint}` }
      })
    );
  }
}

proxyHealthEndpoints('/api/usuarios', process.env.USUARIOS_SERVICE_URL);
proxyHealthEndpoints('/api/productos', process.env.PRODUCTOS_SERVICE_URL);
proxyHealthEndpoints('/api/pedidos', process.env.PEDIDOS_SERVICE_URL);

app.use(
  '/api/usuarios',
  createProxyMiddleware({
    target: process.env.USUARIOS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/usuarios': '/usuarios' }
  })
);

app.use(
  '/api/productos',
  createProxyMiddleware({
    target: process.env.PRODUCTOS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/productos': '/productos' }
  })
);

app.use(
  '/api/pedidos',
  createProxyMiddleware({
    target: process.env.PEDIDOS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/pedidos': '/pedidos' }
  })
);

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no reconocida por el API Gateway' });
});

app.listen(PORT, () => {
  console.log(`[api-gateway] escuchando en puerto ${PORT}`);
});
