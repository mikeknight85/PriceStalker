import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { currencyConversionService } from '../../src/services/domain/system/CurrencyConversionService';
import { exchangeRateRepository } from '../../src/models';

vi.mock('axios');
vi.mock('../../src/models', () => ({
  exchangeRateRepository: {
    getRate: vi.fn(),
    upsert: vi.fn(),
  },
}));

describe('CurrencyConversionService (Failure Paths & Boundaries)', () => {
  const mockedGetRate = exchangeRateRepository.getRate as unknown as ReturnType<typeof vi.fn>;
  const mockedUpsert = exchangeRateRepository.upsert as unknown as ReturnType<typeof vi.fn>;
  const mockedAxiosGet = axios.get as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('convert', () => {
    it('returns exact amount for identity conversions case-insensitively without DB queries', async () => {
      expect(await currencyConversionService.convert(123.45, 'USD', 'USD')).toBe(123.45);
      expect(await currencyConversionService.convert(99.99, 'eur', 'EUR')).toBe(99.99);
      expect(mockedGetRate).not.toHaveBeenCalled();
    });

    it('handles zero and negative amounts accurately', async () => {
      mockedGetRate.mockResolvedValue(1.2);
      expect(await currencyConversionService.convert(0, 'EUR', 'USD')).toBe(0);
      expect(await currencyConversionService.convert(-50, 'EUR', 'USD')).toBe(-60);
    });

    it('rounds to 2 decimal places properly', async () => {
      // 10 * 1.33333 = 13.3333 -> 13.33
      mockedGetRate.mockResolvedValue(1.33333);
      expect(await currencyConversionService.convert(10, 'GBP', 'USD')).toBe(13.33);

      // 10 * 1.33555 = 13.3555 -> 13.36
      mockedGetRate.mockResolvedValue(1.33555);
      expect(await currencyConversionService.convert(10, 'GBP', 'USD')).toBe(13.36);
    });

    it('performs indirect triangulation via EUR when direct rate is missing', async () => {
      // Direct rate is null
      mockedGetRate.mockImplementation(async (from: string, to: string) => {
        if (from === 'JPY' && to === 'GBP') return null;
        if (from === 'JPY' && to === 'EUR') return 0.006;
        if (from === 'EUR' && to === 'GBP') return 0.85;
        return null;
      });

      // 1000 JPY * 0.006 (to EUR) * 0.85 (EUR to GBP) = 5.10 GBP
      const result = await currencyConversionService.convert(1000, 'JPY', 'GBP');
      expect(result).toBe(5.1);
    });

    it('returns null when indirect triangulation fails because one leg is missing', async () => {
      mockedGetRate.mockImplementation(async (from: string, to: string) => {
        if (from === 'JPY' && to === 'EUR') return 0.006;
        // EUR -> CHF leg missing
        return null;
      });

      const result = await currencyConversionService.convert(1000, 'JPY', 'CHF');
      expect(result).toBeNull();
    });

    it('safely catches and returns null on database errors without throwing', async () => {
      mockedGetRate.mockRejectedValue(new Error('PostgreSQL connection timeout'));

      const result = await currencyConversionService.convert(100, 'EUR', 'USD');
      expect(result).toBeNull();
    });
  });

  describe('updateRates', () => {
    it('upserts direct and inverse rates for valid provider responses', async () => {
      mockedAxiosGet.mockResolvedValue({
        status: 200,
        data: [
          { base: 'EUR', quote: 'USD', rate: 1.1, date: '2026-05-10' },
          { base: 'EUR', quote: 'GBP', rate: 0.85, date: '2026-05-10' },
        ],
      });
      mockedUpsert.mockResolvedValue(undefined);

      await currencyConversionService.updateRates('EUR');

      expect(mockedUpsert).toHaveBeenCalledTimes(4); // 2 direct + 2 inverse
      expect(mockedUpsert).toHaveBeenCalledWith('EUR', 'USD', 1.1, '2026-05-10', 'frankfurter-v2-blended');
      expect(mockedUpsert).toHaveBeenCalledWith('USD', 'EUR', 1 / 1.1, '2026-05-10', 'frankfurter-v2-blended');
    });

    it('throws when the provider returns an empty array', async () => {
      mockedAxiosGet.mockResolvedValue({ status: 200, data: [] });

      await expect(currencyConversionService.updateRates('EUR')).rejects.toThrow(
        /Unexpected rates response/
      );
    });

    it('throws when the provider returns a non-array response (e.g. error message)', async () => {
      mockedAxiosGet.mockResolvedValue({ status: 502, data: { message: 'Bad Gateway' } });

      await expect(currencyConversionService.updateRates('EUR')).rejects.toThrow(
        /Unexpected rates response/
      );
    });
  });
});
