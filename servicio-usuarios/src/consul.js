function consulUrl() {
  return process.env.CONSUL_URL.replace(/\/$/, '');
}

function registerServiceWithRetry(service, options = {}) {
  const delayMs = options.delayMs || 2000;
  const onRegistered = options.onRegistered || (() => {});
  const onError = options.onError || (() => {});

  async function register() {
    try {
      const response = await fetch(`${consulUrl()}/v1/agent/service/register`, {
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
      if (!response.ok) throw new Error('Consul rechazo el registro');
      onRegistered();
    } catch (error) {
      onError(error);
      setTimeout(register, delayMs);
    }
  }

  register();
}

module.exports = { registerServiceWithRetry };
