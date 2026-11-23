import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from './logger';

describe('Frontend Logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('prints INFO logs with timestamp and context to console.log', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('Connected to server', 'Network');
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toMatch(/\[.*\] INFO \[Network\]: Connected to server/);
  });

  it('prints WARN logs to console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('Slow response');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/\[.*\] WARN: Slow response/);
  });

  it('prints ERROR logs to console.error when passed string message', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('Failed to save', 'Settings');
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy.mock.calls[0][0]).toMatch(/\[.*\] ERROR \[Settings\]: Failed to save/);
  });

  it('prints ERROR logs when passed an Error object as context', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const customErr = new Error('Database connection failed');
    logger.error('Unused message', customErr);
    expect(errSpy).toHaveBeenCalled();
    expect(errSpy.mock.calls[0][0]).toMatch(/\[.*\] ERROR \[Error\]: Database connection failed/);
  });

  it('prints stack trace when extra error argument is passed', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const errObj = new Error('Inner details');
    logger.error('Main error', 'Auth', errObj);
    expect(errSpy).toHaveBeenCalledTimes(2);
    expect(errSpy.mock.calls[1][0]).toContain('Inner details');
  });
});
