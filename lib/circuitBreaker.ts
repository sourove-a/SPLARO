import { AppError } from './error-handler';

type CircuitState = {
  failures: number;
  openedAt: number | null;
  halfOpenSuccesses: number;
};

const circuits = new Map<string, CircuitState>();

function getThreshold(): number {
  const value = Number(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || 5);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 5;
}

function getCooldownMs(): number {
  const value = Number(process.env.CIRCUIT_BREAKER_COOLDOWN_MS || 60_000);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 60_000;
}

function getSuccessThreshold(): number {
  const value = Number(process.env.CIRCUIT_BREAKER_SUCCESS_THRESHOLD || 2);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 2;
}

function now(): number {
  return Date.now();
}

function getState(key: string): CircuitState {
  const existing = circuits.get(key);
  if (existing) return existing;
  const next: CircuitState = {
    failures: 0,
    openedAt: null,
    halfOpenSuccesses: 0,
  };
  circuits.set(key, next);
  return next;
}

export function readCircuitState(key: string): {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  openedAt: number | null;
} {
  const circuit = getState(key);
  if (circuit.openedAt === null) {
    return { state: 'CLOSED', failures: circuit.failures, openedAt: null };
  }
  const elapsed = now() - circuit.openedAt;
  if (elapsed >= getCooldownMs()) {
    return { state: 'HALF_OPEN', failures: circuit.failures, openedAt: circuit.openedAt };
  }
  return { state: 'OPEN', failures: circuit.failures, openedAt: circuit.openedAt };
}

function markFailure(key: string): void {
  const circuit = getState(key);
  circuit.failures += 1;
  circuit.halfOpenSuccesses = 0;
  if (circuit.failures >= getThreshold()) {
    circuit.openedAt = now();
  }
  circuits.set(key, circuit);
}

function markSuccess(key: string): void {
  const circuit = getState(key);
  if (circuit.openedAt !== null) {
    circuit.halfOpenSuccesses += 1;
    if (circuit.halfOpenSuccesses >= getSuccessThreshold()) {
      circuit.failures = 0;
      circuit.openedAt = null;
      circuit.halfOpenSuccesses = 0;
    }
  } else {
    circuit.failures = 0;
  }
  circuits.set(key, circuit);
}

export async function withCircuitBreaker<T>(
  key: string,
  action: () => Promise<T>,
): Promise<T> {
  const circuit = readCircuitState(key);
  if (circuit.state === 'OPEN') {
    throw new AppError({
      code: 'CIRCUIT_OPEN',
      message: `${key} circuit breaker is open.`,
      status: 503,
      expose: true,
      retryable: true,
      details: {
        key,
        failures: circuit.failures,
        openedAt: circuit.openedAt,
      },
    });
  }

  try {
    const result = await action();
    markSuccess(key);
    return result;
  } catch (error) {
    markFailure(key);
    throw error;
  }
}
