const DEFAULT_DELAYS_MS = [500, 1000, 2000];

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function jitter(delayMs) {
  return delayMs + Math.floor(Math.random() * 101);
}

async function retryWithBackoff(operation, options = {}) {
  const delaysMs = options.delaysMs || DEFAULT_DELAYS_MS;
  const onRetry = options.onRetry || (() => {});

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!error.retryable || attempt >= delaysMs.length) {
        throw error;
      }

      const delayMs = jitter(delaysMs[attempt]);
      onRetry({ attempt: attempt + 1, delayMs, error });
      await wait(delayMs);
    }
  }
}

module.exports = { retryWithBackoff };
