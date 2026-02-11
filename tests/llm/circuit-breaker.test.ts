import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCircuitBreaker, CircuitOpenError } from '../../src/llm/circuit-breaker.js';

describe('createCircuitBreaker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should start in CLOSED state', () => {
    const cb = createCircuitBreaker();
    expect(cb.getState()).toBe('CLOSED');
  });

  it('should execute functions normally when CLOSED', async () => {
    const cb = createCircuitBreaker();
    const result = await cb.execute(() => Promise.resolve(42));
    expect(result).toBe(42);
    expect(cb.getState()).toBe('CLOSED');
  });

  it('should stay CLOSED on isolated failures below threshold', async () => {
    const cb = createCircuitBreaker({ failureThreshold: 3 });

    await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow('fail');
    await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow('fail');
    expect(cb.getState()).toBe('CLOSED');
  });

  it('should transition to OPEN after consecutive failures reach threshold', async () => {
    const cb = createCircuitBreaker({ failureThreshold: 3 });

    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    }
    expect(cb.getState()).toBe('OPEN');
  });

  it('should throw CircuitOpenError when OPEN', async () => {
    const cb = createCircuitBreaker({ failureThreshold: 1, recoveryTimeMs: 60_000 });

    await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    await expect(cb.execute(() => Promise.resolve(1))).rejects.toThrow(CircuitOpenError);
  });

  it('should include remaining time in CircuitOpenError', async () => {
    const cb = createCircuitBreaker({ failureThreshold: 1, recoveryTimeMs: 60_000 });

    await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

    try {
      await cb.execute(() => Promise.resolve(1));
    } catch (e) {
      expect(e).toBeInstanceOf(CircuitOpenError);
      expect((e as CircuitOpenError).remainingMs).toBeGreaterThan(0);
      expect((e as CircuitOpenError).remainingMs).toBeLessThanOrEqual(60_000);
    }
  });

  it('should transition to HALF_OPEN after recovery time', async () => {
    vi.useFakeTimers();
    const cb = createCircuitBreaker({ failureThreshold: 1, recoveryTimeMs: 5000 });

    await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    vi.advanceTimersByTime(5000);

    // Next execute should try (HALF_OPEN)
    const result = await cb.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
    expect(cb.getState()).toBe('HALF_OPEN');

    vi.useRealTimers();
  });

  it('should close after enough successes in HALF_OPEN', async () => {
    vi.useFakeTimers();
    const cb = createCircuitBreaker({
      failureThreshold: 1,
      recoveryTimeMs: 1000,
      halfOpenMaxAttempts: 2,
    });

    await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    vi.advanceTimersByTime(1000);

    await cb.execute(() => Promise.resolve('ok1'));
    expect(cb.getState()).toBe('HALF_OPEN');

    await cb.execute(() => Promise.resolve('ok2'));
    expect(cb.getState()).toBe('CLOSED');

    vi.useRealTimers();
  });

  it('should revert to OPEN on failure during HALF_OPEN', async () => {
    vi.useFakeTimers();
    const cb = createCircuitBreaker({
      failureThreshold: 1,
      recoveryTimeMs: 1000,
      halfOpenMaxAttempts: 3,
    });

    await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    vi.advanceTimersByTime(1000);

    await cb.execute(() => Promise.resolve('ok'));
    expect(cb.getState()).toBe('HALF_OPEN');

    await expect(cb.execute(() => Promise.reject(new Error('fail again')))).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    vi.useRealTimers();
  });

  it('should reset consecutive failures on success in CLOSED', async () => {
    const cb = createCircuitBreaker({ failureThreshold: 3 });

    await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    // 2 failures, then success resets counter
    await cb.execute(() => Promise.resolve('ok'));
    expect(cb.getState()).toBe('CLOSED');

    // Need 3 more failures to open
    await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    expect(cb.getState()).toBe('CLOSED');
  });

  it('should reset all state with reset()', async () => {
    const cb = createCircuitBreaker({ failureThreshold: 1 });

    await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    cb.reset();
    expect(cb.getState()).toBe('CLOSED');

    const result = await cb.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });
});
