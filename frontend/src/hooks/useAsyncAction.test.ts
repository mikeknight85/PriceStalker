import { describe, expect, it, vi } from 'vitest';

const mockShowToast = vi.fn();
vi.mock('../context/ToastContext', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: <T>(initial: T) => [initial, vi.fn()],
    useCallback: <T extends Function>(fn: T) => fn,
  };
});

import { useAsyncAction } from './useAsyncAction';

describe('useAsyncAction', () => {
  it('supports string onSuccessMessage', async () => {
    mockShowToast.mockClear();
    const { execute } = useAsyncAction();
    const action = vi.fn().mockResolvedValue({ id: 1, name: 'Product A' });

    const result = await execute(action, {
      onSuccessMessage: 'Action successful',
    });

    expect(result).toEqual({ id: 1, name: 'Product A' });
    expect(mockShowToast).toHaveBeenCalledWith('Action successful', 'success');
  });

  it('supports function onSuccessMessage using action result', async () => {
    mockShowToast.mockClear();
    const { execute } = useAsyncAction();
    const action = vi.fn().mockResolvedValue({ id: 42, name: 'Google Pixel Buds Pro 2' });

    const result = await execute(action, {
      onSuccessMessage: (res: { id: number; name: string }) => `${res.name} price refreshed`,
    });

    expect(result).toEqual({ id: 42, name: 'Google Pixel Buds Pro 2' });
    expect(mockShowToast).toHaveBeenCalledWith('Google Pixel Buds Pro 2 price refreshed', 'success');
  });

  it('displays error toast on rejection with error fallback', async () => {
    mockShowToast.mockClear();
    const { execute } = useAsyncAction();
    const action = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await execute(action, {
      onErrorFallback: 'Failed to refresh price',
    });

    expect(result).toBeUndefined();
    expect(mockShowToast).toHaveBeenCalledWith('Failed to refresh price', 'error');
  });
});
