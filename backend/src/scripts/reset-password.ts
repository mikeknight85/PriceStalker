import bcrypt from 'bcryptjs';
import { userRepository, pool } from '../models';
import crypto from 'crypto';

function generateSecurePassword(length = 16): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*()_+';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

async function main() {
  // --force may appear anywhere; the positionals keep their meaning either way.
  const args = process.argv.slice(2).filter(a => a !== '--force');
  const force = process.argv.slice(2).includes('--force');
  const identifier = args[0];
  const customPassword = args[1];

  if (!identifier) {
    console.log('');
    console.error('Usage: pnpm run reset-password <email-or-user-id> [optional-password] [--force]');
    console.log('Examples:');
    console.log('  pnpm run reset-password admin@example.com');
    console.log('  pnpm run reset-password 1 "MySecretPassword123!"');
    console.log('');
    console.log('  --force  Also set a password on an SSO account. This enables local');
    console.log('           sign-in for it, bypassing the identity provider. Use only');
    console.log('           when SSO itself is broken.');
    console.log('');
    process.exit(1);
  }

  try {
    let user;
    if (/^\d+$/.test(identifier)) {
      user = await userRepository.findById(parseInt(identifier, 10));
    } else {
      user = await userRepository.findByEmail(identifier);
    }

    if (!user) {
      console.error(`\n[ERROR] User not found matching: "${identifier}"`);
      const allUsers = await userRepository.findAll();
      console.log('\nExisting users in database:');
      for (const u of allUsers) {
        console.log(`  - [ID: ${u.id}] ${u.email} (${u.is_admin ? 'Admin' : 'User'})`);
      }
      console.log('');
      process.exit(1);
    }

    if (user.auth_provider === 'oidc' && !force) {
      // UserAccountService.adminUpdateUser refuses this outright, calling it
      // "an authentication bypass rather than a convenience", and it is right:
      // AuthService.loginUser gates only on `!user.password_hash` and never
      // looks at auth_provider. So writing a hash here permanently opens an
      // SSO-provisioned account to the local login form, with a password the
      // identity provider knows nothing about -- bypassing IdP-side MFA and
      // surviving deprovisioning there. A warning is not enough for that.
      //
      // --force exists because this is also the break-glass tool for an
      // instance whose SSO has broken, which is exactly when you cannot go
      // through the admin UI. It has to be asked for explicitly.
      console.error('\n[ERROR] This account signs in through SSO (OIDC).');
      console.error('  Its password is managed by the identity provider. Setting one here would');
      console.error('  enable local sign-in for it, bypassing the provider entirely -- including');
      console.error('  any MFA it enforces, and any later deprovisioning there.');
      console.error('');
      console.error('  If SSO is broken and this is deliberate, re-run with --force.');
      console.error('');
      process.exit(1);
    }

    if (user.auth_provider === 'oidc' && force) {
      console.warn('\n[WARNING] --force: enabling local sign-in for an SSO account.');
      console.warn('  This account can now be reached with a password the identity provider');
      console.warn('  does not know about. Remove the password once SSO is working again.');
    }

    const passwordToSet = customPassword || generateSecurePassword(16);

    if (passwordToSet.length < 8) {
      console.error('\n[ERROR] Password must be at least 8 characters long.\n');
      process.exit(1);
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(passwordToSet, saltRounds);

    // userRepository.updatePassword runs exactly this statement. CLAUDE.md keeps
    // SQL out of everything that is not a repository, and a second copy of the
    // same UPDATE is a second place to forget a WHERE clause.
    await userRepository.updatePassword(user.id, passwordHash);

    console.log('\n---------------------------------------------------------');
    console.log('Password Reset Successfully');
    console.log('---------------------------------------------------------');
    console.log(`User ID:  ${user.id}`);
    console.log(`Email:    ${user.email}`);
    console.log(`Password: ${passwordToSet}`);
    console.log('---------------------------------------------------------');
    console.log('Keep this password secure or share it with the user.');
    console.log('---------------------------------------------------------\n');
  } catch (error) {
    console.error('\n[ERROR] Error resetting password:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
