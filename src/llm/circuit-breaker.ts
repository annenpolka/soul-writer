export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit (default: 5) */
  failureThreshold: number;
  /** Time in ms to keep circuit open before trying half-open (default: 60000) */
  recoveryTimeMs: number;
  /** Number of successful attempts in half-open before closing (default: 2) */
  halfOpenMaxAttempts: number;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitOpenError extends Error {
  constructor(public readonly remainingMs: number) {
    super(`Circuit breaker OPEN: waiting ${Math.ceil(remainingMs / 1000)}s for recovery`);
    this.name = 'CircuitOpenError';
  }
}

export interface CircuitBreaker {
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
  getState: () => CircuitState;
  reset: () => void;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeMs: 60_000,
  halfOpenMaxAttempts: 2,
};

export function createCircuitBreaker(
  config?: Partial<CircuitBreakerConfig>,
): CircuitBreaker {
  const cfg: CircuitBreakerConfig = { ...DEFAULT_CONFIG, ...config };

  let state: CircuitState = 'CLOSED';
  let consecutiveFailures = 0;
  let lastFailureTime = 0;
  let halfOpenSuccesses = 0;

  function onSuccess(): void {
    if (state === 'HALF_OPEN') {
      halfOpenSuccesses++;
      if (halfOpenSuccesses >= cfg.halfOpenMaxAttempts) {
        state = 'CLOSED';
        consecutiveFailures = 0;
        halfOpenSuccesses = 0;
      }
    } else {
      consecutiveFailures = 0;
    }
  }

  function onFailure(): void {
    consecutiveFailures++;
    lastFailureTime = Date.now();
    halfOpenSuccesses = 0;

    if (state === 'HALF_OPEN') {
      state = 'OPEN';
    } else if (consecutiveFailures >= cfg.failureThreshold) {
      state = 'OPEN';
    }
  }

  return {
    async execute<T>(fn: () => Promise<T>): Promise<T> {
      if (state === 'OPEN') {
        const elapsed = Date.now() - lastFailureTime;
        if (elapsed >= cfg.recoveryTimeMs) {
          state = 'HALF_OPEN';
          halfOpenSuccesses = 0;
        } else {
          throw new CircuitOpenError(cfg.recoveryTimeMs - elapsed);
        }
      }

      try {
        const result = await fn();
        onSuccess();
        return result;
      } catch (error) {
        onFailure();
        throw error;
      }
    },

    getState(): CircuitState {
      return state;
    },

    reset(): void {
      state = 'CLOSED';
      consecutiveFailures = 0;
      lastFailureTime = 0;
      halfOpenSuccesses = 0;
    },
  };
}
