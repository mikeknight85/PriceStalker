import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * SSO accounts are provisioned without a password hash and are identified by
 * claims from the identity provider. Two admin operations are unsafe on them,
 * and both have to be refused by the service rather than only hidden in the UI
 * -- a disabled input does not stop anyone calling the endpoint.
 */

const users = {
  findById: vi.fn(),
  adminUpdateUser: vi.fn(),
};

vi.mock('../../src/models', () => ({
  userRepository: users,
}));

vi.mock('../../src/utils/system/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const LOCAL = { id: 1, email: 'local@example.test', auth_provider: 'local' };
const SSO = { id: 2, email: 'sso@example.test', auth_provider: 'oidc' };

async function update(target: typeof LOCAL, body: Record<string, unknown>) {
  users.findById.mockResolvedValue(target);
  users.adminUpdateUser.mockResolvedValue({ ...target, ...body });

  const { userService } = await import('../../src/services/domain/user');
  // 999 is a different admin, so the self-demotion guards do not interfere.
  return userService.adminUpdateUser(target.id, 999, body);
}

describe('Admin user updates on SSO accounts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses to set a password on an SSO account', async () => {
    // Setting one turns on local sign-in for a profile meant to authenticate
    // externally, which is an authentication bypass rather than a convenience.
    await expect(update(SSO, { password: 'longenoughpassword' })).rejects.toThrow(/SSO/);
    expect(users.adminUpdateUser).not.toHaveBeenCalled();
  });

  it('refuses to change the email on an SSO account', async () => {
    // The provider owns the email; changing it locally either breaks the match
    // on next sign-in or is silently overwritten.
    await expect(update(SSO, { email: 'moved@example.test' })).rejects.toThrow(/SSO/);
    expect(users.adminUpdateUser).not.toHaveBeenCalled();
  });

  it('allows resubmitting the same email on an SSO account', async () => {
    // The edit form posts the whole user, so an unrelated change must not be
    // rejected just because the email field was present and unchanged.
    await expect(update(SSO, { email: SSO.email, name: 'Renamed' })).resolves.toBeTruthy();
  });

  it('allows edits that the identity provider does not own', async () => {
    await expect(update(SSO, { name: 'Renamed', currency: 'AUD' })).resolves.toBeTruthy();
    expect(users.adminUpdateUser).toHaveBeenCalled();
  });

  it('leaves local accounts fully editable', async () => {
    await expect(update(LOCAL, { password: 'longenoughpassword' })).resolves.toBeTruthy();
    await expect(update(LOCAL, { email: 'moved@example.test' })).resolves.toBeTruthy();
  });

  it('still rejects a short password on a local account', async () => {
    await expect(update(LOCAL, { password: 'short' })).rejects.toThrow(/at least 8/);
  });

  it('fails clearly when the account does not exist', async () => {
    users.findById.mockResolvedValue(null);
    const { userService } = await import('../../src/services/domain/user');
    await expect(userService.adminUpdateUser(404, 999, { name: 'x' })).rejects.toThrow(/not found/i);
  });
});
