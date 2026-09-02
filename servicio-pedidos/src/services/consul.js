function ensureTrailingSlashRemoved(url) {
  return url.replace(/\/$/, '');
}

function discoveryError(message) {
  const error = new Error(message);
  error.retryable = true;
  error.statusCode = 503;
  return error;
}

async function registerService(service, options = {}) {
  const consulUrl = ensureTrailingSlashRemoved(options.consulUrl || process.env.CONSUL_URL);
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(`${consulUrl}/v1/agent/service/register`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ID: service.id,
      Name: service.name,
      Address: service.address,
      Port: service.port,
      Check: {
        HTTP: service.healthUrl,
        Interval: '10s',
        DeregisterCriticalServiceAfter: '30s'
      }
    })
  });

  if (!response.ok) {
    throw discoveryError(`No se pudo registrar ${service.name} en Consul`);
  }
}

function registerServiceWithRetry(service, options = {}) {
  const delayMs = options.delayMs || 2000;
  const onRegistered = options.onRegistered || (() => {});
  const onError = options.onError || (() => {});

  async function attemptRegistration() {
    try {
      await registerService(service, options);
      onRegistered();
    } catch (error) {
      onError(error);
      setTimeout(attemptRegistration, delayMs);
    }
  }

  attemptRegistration();
}

async function deregisterService(serviceId, options = {}) {
  const consulUrl = ensureTrailingSlashRemoved(options.consulUrl || process.env.CONSUL_URL);
  const fetchImpl = options.fetchImpl || fetch;
  await fetchImpl(`${consulUrl}/v1/agent/service/deregister/${encodeURIComponent(serviceId)}`, {
    method: 'PUT'
  });
}

async function resolveService(serviceName, options = {}) {
  const consulUrl = ensureTrailingSlashRemoved(options.consulUrl || process.env.CONSUL_URL);
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(
    `${consulUrl}/v1/health/service/${encodeURIComponent(serviceName)}?passing=true`
  );

  if (!response.ok) {
    throw discoveryError(`Consul no pudo resolver ${serviceName}`);
  }

  const instances = await response.json();
  if (!instances.length) {
    throw discoveryError(`Consul sin instancias saludables para ${serviceName}`);
  }

  const instance = instances[0];
  const address = instance.Service.Address || instance.Node.Address;
  return `http://${address}:${instance.Service.Port}`;
}

module.exports = { registerService, registerServiceWithRetry, deregisterService, resolveService };
