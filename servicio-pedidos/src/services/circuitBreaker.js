class CircuitOpenError extends Error {
  constructor(serviceName) {
    super(`Circuit breaker abierto para ${serviceName}`);
    this.name = 'CircuitOpenError';
    this.retryable = false;
    this.statusCode = 503;
  }
}

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.resetTimeoutMs = options.resetTimeoutMs || 30000;
    this.now = options.now || Date.now;
    this.serviceName = options.serviceName || 'dependencia';
    this.onStateChange = options.onStateChange || (() => {});
    this.state = 'CLOSED';
    this.failures = 0;
    this.openedAt = null;
  }

  setState(state) {
    if (this.state !== state) {
      this.state = state;
      this.onStateChange({ state, service: this.serviceName });
    }
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (this.now() - this.openedAt < this.resetTimeoutMs) {
        throw new CircuitOpenError(this.serviceName);
      }
      this.setState('HALF_OPEN');
    }

    try {
      const result = await operation();
      this.failures = 0;
      this.openedAt = null;
      this.setState('CLOSED');
      return result;
    } catch (error) {
      this.failures += 1;
      if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
        this.openedAt = this.now();
        this.setState('OPEN');
      }
      throw error;
    }
  }
}

module.exports = { CircuitBreaker, CircuitOpenError };
