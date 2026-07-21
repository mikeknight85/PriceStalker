import { systemApiTokenService } from '../services/domain/token';
import { pool } from '../models';

async function main() {
  const label = process.argv[2];
  if (!label) {
    console.log('');
    console.error('Usage: npm run generate-api-token "Label Name" [description]');
    console.log('');
    process.exit(1);
  }
  const description = process.argv[3];

  try {
    const { token, systemToken } = await systemApiTokenService.createSystemToken({
      label,
      description,
      admin_id: undefined // System generated
    });

    console.log('\n---------------------------------------------------------');
    console.log('✅ API Token Generated Successfully!');
    console.log('---------------------------------------------------------');
    console.log(`ID:      ${systemToken.id}`);
    console.log(`Label:   ${systemToken.label}`);
    console.log(`Token:   ${token}`);
    console.log('---------------------------------------------------------');
    console.log('⚠️  IMPORTANT: Store this token securely.');
    console.log('   This is the ONLY time it will be displayed.');
    console.log('---------------------------------------------------------\n');
  } catch (error) {
    console.error('❌ Error generating token:', error);
  } finally {
    // Ensure the database pool is closed so the script can exit
    await pool.end();
  }
}

main();
