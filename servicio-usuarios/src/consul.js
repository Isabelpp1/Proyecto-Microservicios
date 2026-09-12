function ensureTrailingSlashRemoved(url) {
  return url.replace(/\/$/, '');
}

async function registerService(service, options = {}) {
  const consulUrl = ensureTrailingSlashRemoved(options.consulUrl || process.env.CONSUL_URL);
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(consulUrl + '/v1/agent/service/register', {
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
  if (!response.ok) throw new Error('No se pudo registrar ' + service.name + ' en Consul');
}

function registerServiceWithRetry(service, options = {}) {
  const delayMs = options.delayMs || 2000;
  const onRegistered = options.onRegistered || (() => {});
  const onError = options.onError || (() => {});
  let timer = null;
  let stopped = false;

  async function attemptRegistration() {
    if (stopped) return;
    try {
      await registerService(service, options);
      onRegistered();
    } catch (error) {
      onError(error);
      if (!stopped) timer = setTimeout(attemptRegistration, delayMs);
    }
  }

  attemptRegistration();
  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    }
  };
}

async function deregisterService(serviceId, options = {}) {
  const consulUrl = ensureTrailingSlashRemoved(options.consulUrl || process.env.CONSUL_URL);
  const fetchImpl = options.fetchImpl || fetch;
  await fetchImpl(
    consulUrl + '/v1/agent/service/deregister/' + encodeURIComponent(serviceId),
    { method: 'PUT' }
  );
}

module.exports = {
  registerService,
  registerServiceWithRetry,
  deregisterService
};
