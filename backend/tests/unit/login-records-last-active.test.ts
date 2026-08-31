import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Both authentication paths must stamp last_login_at.
 *
 * This shipped stamping only registration: the edit that added it matched an
 * identical `const token = generateToken(user.id); return { token, user: {` block
 * in registerUser before the one in loginUser. Nothing failed, nothing threw,
 * and the admin column simply read "Never" forever.
 */

const users = {
  findByEmail: vi.fn(),
  create: vi.fn(),
  count: vi.fn().mockResolvedValue(1),
  findAll: vi.fn().mockResolvedValue([]),
  setAdmin: vi.fn(),
  recordLogin: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../src/models', () => ({ userRepository: users }));
vi.mock('../../src/services/domain/system', () => ({
  systemService: { getSetting: vi.fn().mockResolvedValue('true') },
}));
vi.mock('../../src/middleware/auth', () => ({ generateToken: () => 'token' }));
vi.mock('../../src/utils/system/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn().mockResolvedValue(true), hash: vi.fn().mockResolvedValue('hashed') },
}));

const ACCOUNT = {
  id: 42,
  email: 'person@example.test',
  name: 'Person',
  password_hash: 'hashed',
  is_admin: false,
  disabled: false,
};

async function auth() {
  const { authService } = await import('../../src/services/domain/auth');
  return authService;
}

describe('Recording when an account last signed in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    users.recordLogin.mockResolvedValue(undefined);
  });

  it('stamps on a local login', async () => {
    users.findByEmail.mockResolvedValue(ACCOUNT);

    await (await auth()).loginUser(ACCOUNT.email, 'longenoughpassword');

    expect(users.recordLogin).toHaveBeenCalledWith(ACCOUNT.id);
  });

  it('stamps on registration', async () => {
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue({ ...ACCOUNT, id: 7 });

    await (await auth()).registerUser('new@example.test', 'longenoughpassword');

    expect(users.recordLogin).toHaveBeenCalledWith(7);
  });

  it('does not stamp when the password is wrong', async () => {
    const bcrypt = (await import('bcryptjs')).default;
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    users.findByEmail.mockResolvedValue(ACCOUNT);

    await expect((await auth()).loginUser(ACCOUNT.email, 'wrong')).rejects.toThrow();
    expect(users.recordLogin).not.toHaveBeenCalled();
  });

  it('does not stamp when the account is disabled', async () => {
    users.findByEmail.mockResolvedValue({ ...ACCOUNT, disabled: true });

    await expect((await auth()).loginUser(ACCOUNT.email, 'longenoughpassword')).rejects.toThrow();
    expect(users.recordLogin).not.toHaveBeenCalled();
  });

  it('still signs the user in if the stamp fails', async () => {
    // A reporting gap is not a reason to refuse somebody entry.
    users.findByEmail.mockResolvedValue(ACCOUNT);
    users.recordLogin.mockRejectedValue(new Error('database unavailable'));

    const result = await (await auth()).loginUser(ACCOUNT.email, 'longenoughpassword');

    expect(result.token).toBeTruthy();
  });
});
