import { systemApiTokenService } from '../services/domain/token';
import {
  SCOPE_FULL,
  TOKEN_SCOPES,
  TOKEN_SCOPE_DESCRIPTIONS,
  TokenScope,
  parseScopes
} from '../services/domain/token/scopes';
import { pool, userRepository } from '../models';

/**
 * Mints a system API token from the server host.
 *
 * Two things changed here with issue #217.
 *
 * The token is linked to a real administrator. This script used to pass
 * `admin_id: undefined`, and `authMiddleware` made up the difference with
 * `req.userId = sysToken.admin_id || 1` -- so a token generated here silently
 * acted as whoever user 1 happens to be. That fallback is gone, so the linkage
 * has to be explicit: either the account named with `--user`, or, failing that,
 * the longest-standing administrator on the installation.
 *
 * The token carries scopes. `--scopes` takes a comma-separated list; omitting
 * it keeps the behaviour this script has always had (full access) so that
 * whatever an operator automated around it still works, but it says so.
 */

const usage = () => {
  console.log('');
  console.error('Usage: pnpm run generate-api-token "Label" [description] [--user <email>] [--scopes a,b]');
  console.log('');
  console.log('Scopes:');
  for (const scope of TOKEN_SCOPES) {
    console.log(`  ${scope.padEnd(14)} ${TOKEN_SCOPE_DESCRIPTIONS[scope]}`);
  }
  console.log('');
  console.log("Omitting --scopes grants '*' (full access), which is deprecated.");
  console.log('');
};

const takeFlag = (argv: string[], name: string): string | undefined => {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  argv.splice(index, value === undefined ? 1 : 2);
  return value;
};

async function resolveAdminId(email: string | undefined): Promise<number> {
  if (email) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error(`No account found for '${email}'.`);
    }
    if (!user.is_admin) {
      throw new Error(
        `'${email}' is not an administrator. A system token inherits its account's privileges, ` +
          `so linking one to a non-admin account produces a token that cannot reach /api/admin.`
      );
    }
    return user.id;
  }

  const admins = await userRepository.findAdmins();
  const owner = admins[0];
  if (!owner) {
    throw new Error(
      'This installation has no administrator account to link the token to. Create one first.'
    );
  }
  // The id, not the address: console output is not scrubbed, and the operator
  // can look the account up in Admin.
  console.log(`[INFO] No --user given; linking the token to administrator #${owner.id}.`);
  return owner.id;
}

async function main() {
  const argv = process.argv.slice(2);
  const userEmail = takeFlag(argv, '--user');
  const scopesArg = takeFlag(argv, '--scopes');

  const label = argv[0];
  if (!label) {
    usage();
    process.exit(1);
  }
  const description = argv[1];

  try {
    const scopes: TokenScope[] = scopesArg
      ? parseScopes(scopesArg.split(',').map(entry => entry.trim()).filter(Boolean))
      : [SCOPE_FULL];

    const adminId = await resolveAdminId(userEmail);

    const { token, systemToken } = await systemApiTokenService.createSystemToken({
      label,
      description,
      admin_id: adminId,
      scopes
    });

    console.log('\n---------------------------------------------------------');
    console.log('API Token Generated Successfully');
    console.log('---------------------------------------------------------');
    console.log(`ID:      ${systemToken.id}`);
    console.log(`Label:   ${systemToken.label}`);
    console.log(`Scopes:  ${systemToken.scopes.join(', ')}`);
    console.log(`Token:   ${token}`);
    console.log('---------------------------------------------------------');
    console.log('[IMPORTANT] Store this token securely.');
    console.log('  This is the ONLY time it will be displayed.');
    if (scopes.includes(SCOPE_FULL)) {
      console.log('  This token has full access. Pass --scopes to narrow it.');
    }
    console.log('---------------------------------------------------------\n');
  } catch (error) {
    console.error('[ERROR] Error generating token:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    // Ensure the database pool is closed so the script can exit
    await pool.end();
  }
}

main();
