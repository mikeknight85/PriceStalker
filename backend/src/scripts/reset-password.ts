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
  const identifier = process.argv[2];
  const customPassword = process.argv[3];

  if (!identifier) {
    console.log('');
    console.error('Usage: pnpm run reset-password <email-or-user-id> [optional-password]');
    console.log('Examples:');
    console.log('  pnpm run reset-password admin@example.com');
    console.log('  pnpm run reset-password 1 "MySecretPassword123!"');
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

    if (user.auth_provider === 'oidc') {
      console.warn('\n[WARNING] This account signs in via SSO (OIDC).');
      console.warn('  Setting a local password enables local password authentication for this user.');
    }

    const passwordToSet = customPassword || generateSecurePassword(16);

    if (passwordToSet.length < 8) {
      console.error('\n[ERROR] Password must be at least 8 characters long.\n');
      process.exit(1);
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(passwordToSet, saltRounds);

    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user.id]);

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
